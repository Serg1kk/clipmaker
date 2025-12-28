import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Projects from './pages/Projects';
import ProjectEditor from './pages/ProjectEditor';
import Renders from './pages/Renders';
import CropperDemo from './pages/CropperDemo';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:projectId" element={<ProjectEditor />} />
          <Route path="renders" element={<Renders />} />
          <Route path="cropper-demo" element={<CropperDemo />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
