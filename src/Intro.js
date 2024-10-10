import user from './data/Daniel_2022.png';
import { ImMail, ImFacebook2, ImGithub, ImBook, ImBriefcase } from 'react-icons/im';

const Intro = () => {
    return (
        <div className="intro">
            <div className="user">
                <img src={user} className="logo" alt="It's me. Daniel!" />
            </div>
            <div>
                <h2>林致嘉 Daniel Lin</h2>
                <p>
                    <ImBook />
                    &ensp;國立高雄科技大學—資訊管理系
                </p>
                <p>
                    <ImBriefcase />
                    &ensp;萊恩設計—全端工程師
                </p>
                <p>
                    <ImBriefcase />
                    &ensp;高雄雙欣科技產學合作—後端工程師
                </p>
                <p>
                    <ImMail />
                    &ensp;open94006880103@gmail.com
                </p>
                <p>
                    <ImFacebook2 />
                    &ensp;
                    <a href="https://www.facebook.com/open94006/" target="_blank" rel="noopener noreferrer">
                        Facebook
                    </a>
                </p>
                <p>
                    <ImGithub />
                    &ensp;
                    <a href="https://github.com/open94006" target="_blank" rel="noopener noreferrer">
                        GitHub
                    </a>
                </p>
                <hr />
            </div>
        </div>
    );
};

export default Intro;
