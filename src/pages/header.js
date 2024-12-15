function Header() {
    <div className="menu">
        <IconContext.Provider value={{ className: 'tagbox' }}>
            <div className="tag">
                <Link to="/" style={{ textDecoration: 'none' }}>
                    <FcHome />
                    <h4>首頁</h4>
                </Link>
            </div>
            <div className="tag">
                <Link to="/project" style={{ textDecoration: 'none' }}>
                    <FcSurvey />
                    <h4>作品</h4>
                </Link>
            </div>
            <div className="tag">
                <Link to="/exp" style={{ textDecoration: 'none' }}>
                    <FcTimeline />
                    <h4>經歷</h4>
                </Link>
            </div>
            {/* <div className="tag">
                <Link to="/link" style={{ textDecoration: 'none' }}><FcLink /><h4>URL</h4></Link>
            </div> */}
        </IconContext.Provider>
    </div>;
}

export default Header;
