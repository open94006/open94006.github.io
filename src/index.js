import React from 'react';
import ReactDOM from 'react-dom';
import Menu from './Menu';
import Main from './component/Main';
import Intro from './Intro';
import "./style.css";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import Article from './component/Article';
import Hyperlink from './component/Link';
import Project from './component/Project';

ReactDOM.render(
  <div>
    <BrowserRouter>
      <Menu />
      <Routes>
        <Route path="/" element={<Main />} />
        <Route path="/article" element={<Article />} />
        <Route path="/link" element={<Hyperlink />} />
        <Route path="/project" element={<Project />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Intro />
    </BrowserRouter>
  </div>,
  document.getElementById('root')
);
