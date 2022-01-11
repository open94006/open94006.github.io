import React from 'react';
import ReactDOM from 'react-dom';
import Menu from './Menu';
import Main from './component/Main';
import Intro from './Intro';
import "./style.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Exp from './component/Exp';
import Hyperlink from './component/Link';
import Project from './component/Project';

ReactDOM.render(
  <div>
    <BrowserRouter>
      <Menu />
      <Routes>
        <Route path="/" element={<Main />} />
        <Route path="/exp" element={<Exp />} />
        <Route path="/link" element={<Hyperlink />} />
        <Route path="/project" element={<Project />} />
      </Routes>
      <Intro />
    </BrowserRouter>
  </div>,
  document.getElementById('root')
);
