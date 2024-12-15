import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Main from './pages/main';
import Header from './pages/header';
import Footer from './pages/footer';
import './asset/css/main.css';

const App = () => (
    <BrowserRouter>
        <Header></Header>
        <div>
            <Routes>
                <Route path="/" element={<Main fileName="about" />} />
                <Route path="/exp" element={<Main fileName="exp" />} />
                <Route path="/about" element={<Main fileName="about" />} />
            </Routes>
        </div>
        <Footer></Footer>
    </BrowserRouter>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
