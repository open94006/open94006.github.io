import user from "./data/Daniel_2022.png";
import { ImMail, ImFacebook2, ImGithub } from 'react-icons/im';

const Intro = () => {
    return (
        <div className="intro">
            <div className="user">
                <img src={user} className="logo" alt="It's me. Daniel!" />
            </div>
            <div>
                <h2>林致嘉 Daniel Lin</h2>
                <p>畢業於<b>高雄科技大學資訊管理系</b>，行事風格習慣規劃後並踏實完成。</p>
                <p>大學期間曾任系學會副會長、系籃隊長、班級代表、畢業代表等職務，曾任高雄雙欣科技<b>實習PHP工程師半年</b>。
                </p>
                <hr />
            </div>
            <div>
                <h4>聯絡方式</h4>
                <p><ImMail />&ensp;open94006880103@gmail.com</p>
                <p><ImFacebook2 />&ensp;
                    <a href="https://www.facebook.com/open94006/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Facebook
                    </a>
                </p>
                <p><ImGithub />&ensp;
                    <a href="https://github.com/open94006"
                        target="_blank"
                        rel="noopener noreferrer">
                        GitHub
                    </a>
                </p>
                <hr />
            </div>

        </div>
    );
}

export default Intro;
