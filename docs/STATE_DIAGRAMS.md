# useProgress Hook - State Diagrams & Flow Charts

**Purpose:** Visual reference for hook state transitions and error handling flows
**Format:** ASCII state diagrams and flow charts

---

## State Machine Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        useProgress Hook State Machine                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                                    INITIAL
                                      │
                                      │ (jobId provided)
                                      ▼
                    ┌──────────────────────────────────┐
                    │  DISCONNECTED / UNSUPPORTED      │
                    │  ─ isConnected: false           │
                    │  ─ isReconnecting: false        │
                    │  ─ error: null                  │
                    └──────────────────────────────────┘
                       ▲ │
         (jobId cleared)│ │ (jobId provided & supported)
                       │ ▼
                    ┌──────────────────────────────────┐
                    │  CONNECTING                      │
                    │  ─ isConnected: false           │
                    │  ─ isReconnecting: true         │
                    │  ─ error: null                  │
                    │  ─ reconnectAttempt: 0          │
                    └──────────────────────────────────┘
                       ▲ │
      (timeout/error)  │ │ (socket opens)
                       │ ▼
                    ┌──────────────────────────────────┐
        ┌─────────►│  CONNECTED                       │◄─────────┐
        │          │  ─ isConnected: true            │          │
        │          │  ─ isReconnecting: false        │          │
        │          │  ─ error: null                  │          │
        │          │  ─ reconnectAttempt: 0          │          │
        │          └──────────────────────────────────┘          │
        │             ▲ │                            │           │
        │             │ │ (message received)         │ (socket   │
        │             │ ▼                            │ closes)   │
        │             │ {update state}               │           │
        │             │ (progress, stage, message)   ▼           │
        │             └──────────────────────────────┐           │
        │                                            │           │
        │    ┌──────────────────────────────────────────────────┐│
        │    │  RECONNECTING                                  ││
        │    │  ─ isConnected: false                          ││
        │    │  ─ isReconnecting: true                        ││
        │    │  ─ reconnectAttempt: 1..N                      ││
        │    │  ─ error: "Reconnecting..." (initially)        ││
        └────┤  ─ lastKnownProgress: preserved                ││
             │  ─ lastKnownStage: preserved                  ││
             └──────────────────────────────────────────────────┘│
                   ▲ │                                        │
      (reconnect   │ │ (attempt N < MAX)                      │
       success)    │ ▼                                        │
                   │ Wait (backoff)                          │
                   │ Reconnect →                            │
                   │ Retry                                  │
                   │                                        │
                   └────────────────────────────────────────┘
                      ▲ │
     (attempts < max) │ │ (attempt MAX reached)
                      │ ▼
                   ┌──────────────────────────────────┐
                   │  FAILED                          │
                   │  ─ isConnected: false           │
                   │  ─ isReconnecting: false        │
                   │  ─ error: "Failed after N attempts"
                   │  ─ canRetryManually: true       │
                   └──────────────────────────────────┘
                      ▲ │
    (user click        │ │ (manual retry)
     retry)            │ ▼
                       │ Reset reconnectAttempt to 0
                       │ Go to RECONNECTING
                       │
                       └────────────────────────────────────┘

Terminal States:
├─ FAILED (user action needed)
├─ COMPLETED (job done, server closed 1000 with "completed")
└─ JOB_FAILED (job failed, server closed 1000 with "failed")

Transition Triggers:
├─ socket.onopen → CONNECTING → CONNECTED
├─ socket.onerror → CONNECTED → RECONNECTING
├─ socket.onclose(1000, "completed") → Any → COMPLETED
├─ socket.onclose(1000, "failed:...") → Any → JOB_FAILED
├─ socket.onclose(other codes) → CONNECTED → RECONNECTING
├─ max attempts → RECONNECTING → FAILED
├─ user clicks retry → FAILED → RECONNECTING
├─ jobId changes → Any → DISCONNECTED (reset)
└─ component unmounts → Any → cleanup
```

---

## Connection Failure Recovery Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│              Connection Failure Detection & Recovery                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

                          socket.onerror
                          or
                          socket.onclose (1006)
                              │
                              ▼
                    ┌──────────────────────┐
                    │ Log error            │
                    │ Set isReconnecting   │
                    │ Preserve state       │
                    └──────────────────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │ Calculate backoff    │
                    │ backoff[n] =         │
                    │   min(1s * 2^n,      │
                    │       30s) + jitter  │
                    └──────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │ Check: attempt < MAX?         │
              │  (5 default)                  │
              └───────────────────────────────┘
                  │              │
                  │ YES          │ NO
                  ▼              ▼
            Schedule       Show error:
            Reconnection   "Max attempts
                           exceeded"
                              │
                              ▼
                         Set canRetryManually
                         Show action buttons:
                         - Refresh Page
                         - Retry Now
                         - Contact Support
                              │
                              ▼
         ┌─────────────────────┴──────────────┐
         │                                    │
    User clicks               User clicks
    Refresh Page              Retry Now
         │                        │
         ▼                        ▼
    Full page reload       Reset attempt counter
                           Go to RECONNECTING
                           Single retry attempt

Wait (backoff delay)
    │
    ▼
Attempt connection
    │
    ├─ Success → Update isConnected, clear error
    └─ Fail → Check attempt count, loop or fail
```

---

## Invalid JSON Handling Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                   Invalid JSON Error Handling                           │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

              socket.onmessage
                  │
                  ▼
         ┌────────────────────┐
         │ Try JSON.parse()   │
         └────────────────────┘
              │
         ┌────┴────┐
         │          │
      Success   Error (SyntaxError)
         │          │
         ▼          ▼
    ┌───────────┐  ┌──────────────────────┐
    │ Validate  │  │ Log error to console │
    │ Structure │  │ (not user-facing)    │
    └───────────┘  └──────────────────────┘
         │                    │
    ┌────┴────┐              ▼
    │          │       Increment invalid count
  Valid   Invalid       invalidMessageCount++
    │          │              │
    ▼          ▼              ▼
  Process   Reset     ┌─────────────────┐
  Message   counter   │ Check threshold │
    │                 │ invalidCount > 10
  Done   ┌────────────┤ in 60s window   │
         │            └─────────────────┘
         │                │
         │          ┌─────┴──────┐
         │          │            │
         │       YES            NO
         │       │              │
         │       ▼              ▼
         │    Close     Continue listening
         │    connection
         │       │
         │       ▼
         │    Reconnect
         │    (start exponential backoff)
         │
         └───────────────────┐
                             │
                        (5 min timeout)
                             │
                             ▼
                    Reset invalid counter
```

---

## Network Interruption & Resume Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│            Network Interruption Detection & Resumption                  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

                    CONNECTED STATE
                  (receiving messages)
                         │
                         │ socket.onclose(1006)
                         │ Network cable pulled
                         │ WiFi disconnected
                         │ etc.
                         ▼
              ┌──────────────────────────┐
              │ Save Current State:      │
              │ - lastProgress = 45      │
              │ - lastStage = transcr... │
              │ - timestamp = now        │
              └──────────────────────────┘
                         │
                         ▼
              ┌──────────────────────────┐
              │ Update UI Display:       │
              │ - Show last progress     │
              │ - Show status            │
              │ - Show: "Reconnecting.." │
              │ - Hidden: error details  │
              └──────────────────────────┘
                         │
                         ▼
                   Brief Outage
                   < 2 minutes
                         │
                   ┌─────┴────────┐
                   │ (user's view) │
                   └─────┬────────┘
                         │
         ┌───────────────┴───────────────┐
         │ Progress stays at 45%         │
         │ Message: "Reconnecting..."    │
         │ Spinner showing              │
         └───────────────┬───────────────┘
                         │
                         ▼
                   Connection Restored
                         │
                         ▼
              ┌──────────────────────────┐
              │ Reconnect (auto,         │
              │   exponential backoff)   │
              └──────────────────────────┘
                         │
                         ▼
              ┌──────────────────────────┐
              │ Server sends update:     │
              │ {progress: 47, ...}      │
              │ (job continued while     │
              │  we were offline)        │
              └──────────────────────────┘
                         │
                         ▼
              ┌──────────────────────────┐
              │ Update UI Transparently: │
              │ - Progress jumps 45→47   │
              │ - Remove spinner         │
              │ - User notices quick fix │
              │ - No manual action neede │
              └──────────────────────────┘
                         │
                         ▼
                    Continue normally
                   (receiving messages)

Long Outage (> 2 minutes):
├─ Max reconnect attempts exceeded
├─ Show: "Unable to connect after 5 attempts"
├─ Action: "Refresh page or retry"
└─ User must take action to recover
```

---

## Job ID Change Handling Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                    Job ID Change Detection & Switch                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

                      jobId prop changes
                      (job-1 → job-2)
                            │
                            ▼
          ┌──────────────────────────────┐
          │ useEffect triggered          │
          │ (dependency: [jobId])        │
          └──────────────────────────────┘
                            │
                            ▼
          ┌──────────────────────────────┐
          │ Close old connection         │
          │ websocket.close(1000,        │
          │   "Job ID changed")          │
          └──────────────────────────────┘
                            │
                            ▼
          ┌──────────────────────────────┐
          │ Cancel pending timers        │
          │ - reconnectTimeout.clear()   │
          │ - pollingTimeout.clear()     │
          └──────────────────────────────┘
                            │
                            ▼
          ┌──────────────────────────────┐
          │ Reset all state              │
          │ - progress = 0               │
          │ - stage = "pending"          │
          │ - message = ""               │
          │ - error = null               │
          │ - isConnected = false        │
          │ - isReconnecting = false     │
          │ - reconnectAttempt = 0       │
          └──────────────────────────────┘
                            │
                            ▼
          ┌──────────────────────────────┐
          │ UI shows "Connecting..."     │
          │ (Loading spinner appears)    │
          └──────────────────────────────┘
                            │
                            ▼
          ┌──────────────────────────────┐
          │ Connect to new job           │
          │ websocket.new(               │
          │   /ws/job/job-2)             │
          └──────────────────────────────┘
                            │
                    ┌───────┴──────┐
                    │              │
                 Success        Fail
                    │              │
                    ▼              ▼
          ┌──────────────────┐  Exponential
          │ Receive message: │  backoff retry
          │ {job_id: "job-2",│
          │  progress: 0,    │
          │  stage: pending} │
          └──────────────────┘
                    │
                    ▼
          Update UI with job-2 progress

Simultaneous Messages from Old Job:
                            │
          Message arrives:  │
          {job_id: "job-1", │
           progress: 50}    │
                            │
                            ▼
          ┌──────────────────────────────┐
          │ Filter check:                │
          │ if (msg.job_id !== jobId)    │
          │   return; (ignore)           │
          │ console.warn("ignoring...")  │
          └──────────────────────────────┘
                            │
                            ▼
                    Message dropped
                    (not processed)
```

---

## Component Unmount Cleanup Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                        Component Unmount Cleanup                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

                   Component unmounts
                    (route change,
                    modal closes, etc.)
                            │
                            ▼
          ┌──────────────────────────────┐
          │ useEffect cleanup runs       │
          │ return () => { ... }         │
          └──────────────────────────────┘
                            │
                            ▼
          ┌──────────────────────────────┐
          │ Mark as unmounting           │
          │ isMountedRef.current = false │
          │ (prevents setState calls)    │
          └──────────────────────────────┘
                            │
                            ▼
          ┌──────────────────────────────┐
          │ Clear timeouts               │
          │ clearTimeout(reconnectId)    │
          │ clearTimeout(pollingId)      │
          │ clearTimeout(heartbeatId)    │
          └──────────────────────────────┘
                            │
                            ▼
          ┌──────────────────────────────┐
          │ Close WebSocket              │
          │ if (ws && open) {             │
          │   ws.close(1000, "unmount")  │
          │ }                             │
          └──────────────────────────────┘
                            │
                            ▼
          ┌──────────────────────────────┐
          │ Abort pending requests       │
          │ abortController.abort()      │
          └──────────────────────────────┘
                            │
                            ▼
          ┌──────────────────────────────┐
          │ Clear event listeners        │
          │ ws.onopen = null             │
          │ ws.onmessage = null          │
          │ ws.onerror = null            │
          │ ws.onclose = null            │
          └──────────────────────────────┘
                            │
                            ▼
          ┌──────────────────────────────┐
          │ Cleanup complete             │
          │ No memory leaks              │
          │ No warnings in console       │
          │ No dangling connections      │
          └──────────────────────────────┘

After Cleanup (Pending Message Arrives):
                            │
    Message event queued    │
    but component gone      │
                            ▼
          Check: isMountedRef.current?
                │
            │   NO
            │   ▼
        Don't execute setState
        Function returns early
        No "update on unmounted" warning
```

---

## Max Reconnection Attempts Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│               Maximum Reconnection Attempts & Recovery                  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

                   Connection Failed
                   (socket.onerror)
                            │
                            ▼
                   Attempt 1: Immediate
                            │
                   Wait: 1s + jitter
                            ▼
                   Attempt 2: ~2s
                            │
                   Wait: 2s + jitter
                            ▼
                   Attempt 3: ~4s
                            │
                   Wait: 4s + jitter
                            ▼
                   Attempt 4: ~8s
                            │
                   Wait: 8s + jitter
                            ▼
                   Attempt 5: ~16s
                            │
                   Wait: 16s + jitter
                            ▼
              ┌──────────────────────────┐
              │ Check: attempt >= MAX?   │
              │ (5 by default)           │
              └──────────────────────────┘
                            │
                     ┌──────┴──────┐
                     │             │
                   YES            NO
                     │             │
                     ▼             ▼
          ┌────────────────────┐ Loop back
          │ STOP retrying      │ to wait
          │ Set state:         │
          │ - isReconnecting   │
          │   = false          │
          │ - error =          │
          │   "Failed after    │
          │   5 attempts"      │
          │ - canRetryManually │
          │   = true           │
          └────────────────────┘
                     │
                     ▼
          ┌────────────────────────────┐
          │ Display Error UI            │
          │                            │
          │ "Failed to connect after   │
          │  5 attempts."              │
          │                            │
          │ [Refresh Page] button      │
          │ [Retry Now]    button      │
          │ [Get Help]     link        │
          └────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
       User Action 1        User Action 2
          │                     │
          ▼                     ▼
    "Refresh Page"         "Retry Now"
          │                     │
          ▼                     ▼
    Full page reload    Reset reconnectAttempt = 0
    (F5 or ctrl+R)      Attempt immediate connection
                        Single attempt only
                             │
                      ┌──────┴──────┐
                      │             │
                   Success       Fail
                      │             │
                      ▼             ▼
                  Resume      Show error again
                  normally    "Retry now"
                              button still available

Time Estimate:
- Total retry time: ~1s + ~2s + ~4s + ~8s + ~16s
                  = ~31 seconds
- With jitter: 35-40 seconds
- User sees: "Reconnecting..." for ~40 seconds
- Then: Clear error message with action buttons
```

---

## Browser Support Detection Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│              Browser WebSocket Support Detection & Fallback             │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

              Hook initialization
              useProgress('job-123')
                        │
                        ▼
          ┌──────────────────────────┐
          │ Check: typeof WebSocket  │
          │        !== 'undefined'   │
          └──────────────────────────┘
                        │
                ┌───────┴──────┐
                │              │
            Supported    Not Supported
                │              │
                ▼              ▼
          Proceed to    ┌────────────────────┐
          WebSocket     │ Set:               │
          connection    │ - isSupported      │
                        │   = false          │
                        │ - error =          │
                        │   "WebSocket not   │
                        │   supported"       │
                        └────────────────────┘
                                 │
                                 ▼
                        Check config option:
                        enablePollingFallback
                                 │
                        ┌────────┴────────┐
                        │                 │
                      true              false
                        │                 │
                        ▼                 ▼
                 ┌──────────────┐   ┌─────────────────┐
                 │ Start polling│   │ Show message:   │
                 │ fallback:    │   │ "This browser   │
                 │ fetch every  │   │  is too old.    │
                 │ 2 seconds    │   │  Please upgrade│
                 │              │   │ to modern      │
                 │ setInterval( │   │ browser"        │
                 │   () => {    │   │                 │
                 │   fetch(     │   │ Show links:     │
                 │   /progress/ │   │ - Chrome       │
                 │   job-123)   │   │ - Firefox      │
                 │   },         │   │ - Safari       │
                 │   2000       │   │ - Edge         │
                 │ )            │   └─────────────────┘
                 └──────────────┘

Polling Fallback Loop:
                        │
                        ▼
          ┌──────────────────────────┐
          │ Fetch /api/progress/     │
          │ job-123 every 2s         │
          └──────────────────────────┘
                        │
                ┌───────┴────────┐
                │                │
            Success          Fail
                │                │
                ▼                ▼
          Update state      Retry or error
          from response
                │
                ▼
          Check stage:
          - completed → stop polling
          - failed → stop polling
          - pending/extracting/transcr... → continue
                │
                ▼
          Wait 2 seconds
          (loop back to fetch)

User Experience:
┌────────────────────────────────┐
│ Show: "Using fallback updates" │
│ (Every 2 seconds update delay) │
│                                │
│ Progress updates work          │
│ But not real-time              │
│ (2-4 second latency)           │
└────────────────────────────────┘
```

---

## WebSocket Close Code Decision Tree

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│              WebSocket Close Code Interpretation Tree                   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

                      socket.onclose
                   {code, reason}
                            │
                            ▼
                    ┌──────────────┐
                    │ Check code   │
                    └──────────────┘
                            │
        ┌───┬───┬───┬───┬───┼───┬───┬────┐
        │   │   │   │   │   │   │   │    │
      1000 1001 1002 1003 1006 1008 1009 1011 1012 1013
        │   │   │   │   │   │   │   │    │    │
        ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼    ▼    ▼
       Normal Going Protocol Unsupported Abnormal Policy Message Server Service
       Closure Away   Error    Data       (Network) Violation Size Error  Restart
                                                                         Throttled
        │   │   │   │   │   │   │   │    │    │
        │   │   │   │   │   │   │   │    │    └──► Reconnect (longer backoff)
        │   │   │   │   │   │   │   │    │
        │   │   │   │   │   │   │   │    └──────► Reconnect with backoff
        │   │   │   │   │   │   │   │
        │   │   │   │   │   │   │   └──────────► DO NOT reconnect
        │   │   │   │   │   │   │                Show error
        │   │   │   │   │   │   │
        │   │   │   │   │   │   └─────────────► DO NOT reconnect
        │   │   │   │   │   │                   Show error
        │   │   │   │   │   │
        │   │   │   │   │   └──────────────────► DO NOT reconnect
        │   │   │   │   │                        Show error
        │   │   │   │   │
        │   │   │   │   └────────────────────► RECONNECT immediately
        │   │   │   │                          (abnormal termination)
        │   │   │   │                          standard exponential backoff
        │   │   │   │
        │   │   │   └─────────────────────► DO NOT reconnect (unsupported)
        │   │   │
        │   │   └──────────────────────────► Log error, do NOT reconnect
        │   │
        │   └───────────────────────────► Reconnect with longer delay
        │
        └─────────────────────────────► Check close reason string


Check Close Reason (ALL codes):
                        │
                        ▼
            ┌───────────────────────────┐
            │ reason.toLowerCase()      │
            │ includes("completed")?    │
            └───────────────────────────┘
                    │           │
                   YES          NO
                    │           │
                    ▼           ▼
            Set stage to    Continue
            COMPLETED       checking
            progress = 100
            NO reconnect
                            │
                            ▼
            ┌──────────────────────────┐
            │ reason.includes("failed")?
            └──────────────────────────┘
                    │           │
                   YES          NO
                    │           │
                    ▼           ▼
            Set stage to    Use code-based
            FAILED          decision from
            error = reason  tree above
            NO reconnect

Special Cases:
- Code 1000 + reason "completed" → Job finished
- Code 1000 + reason "failed" → Job failed
- Code 1000 + no special reason → Normal closure, don't reconnect
- Code 1006 + no close event → Network reset, reconnect
- Code 1011 + any reason → Server error, reconnect
- Code 1012 + any reason → Service restart, reconnect with longer delay
- Code 1013 + any reason → Service overloaded, reconnect with longer delay
```

---

## Error State & Recovery Summary

```
Error Type              User-Facing           Recovery Action          Result
──────────────────────────────────────────────────────────────────────────────

Connection Failed       "Unable to connect.    Exponential backoff      Try again
                        Retrying..." (1-5x)    (max 5 attempts)         automatically

                        "Failed after 5        Manual retry button      User decides
                        attempts."              or refresh page          what to do

────────────────────────────────────────────────────────────────────────────

Invalid JSON            NOTHING (silent)        Log to console only      Continue
                                                Reconnect if 10+ errors  listening

Network Down            "Reconnecting..."       Automatic reconnect      Resume
                        (shows for ~2 sec)      with state preserved     automatically

────────────────────────────────────────────────────────────────────────────

Job Completed           "Job completed!"       None needed              Final state
                        (final status)         Auto close connection    displayed

Job Failed              "Job failed: [reason]" None needed              Final error
                        (error details)        Auto close connection    displayed

────────────────────────────────────────────────────────────────────────────

No WebSocket            "Please upgrade        Install modern browser   User upgrades
Support                 your browser"          or use polling fallback  browser

Polling                 "Using fallback        Updates every 2 seconds  Slower
Fallback                updates"               (not real-time)          but works

────────────────────────────────────────────────────────────────────────────

Max Attempts            "Failed after 5        User action required     User takes
Exceeded                attempts. Refresh       1. Refresh page          control
                        or retry."             2. Retry now
                                              3. Contact support
```

---

## Conclusion

These state diagrams show:

1. **Main State Machine** - Overall flow from initial to terminal states
2. **Connection Recovery** - Exponential backoff with max attempts
3. **Invalid JSON Handling** - Error detection and reconnection
4. **Network Interruption** - Graceful recovery with state preservation
5. **Job Changes** - Atomic transition to new job
6. **Unmount Cleanup** - Complete resource cleanup
7. **Max Attempts** - Terminal error state with user actions
8. **Browser Support** - Fallback to polling or upgrade message
9. **Close Code Tree** - Decision logic for WebSocket codes
10. **Error Summary** - Quick reference for error handling

These diagrams should be used as a reference during implementation to ensure all state transitions are properly handled.
