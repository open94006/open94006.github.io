import user from "./data/Daniel_2022.jpg";

const Intro = () => {
    return (
        <div className="intro">
            <div className="user">
                <img src={user} className="logo" alt="It's me. Daniel!" />
            </div>
            <div>
                <h2> Daniel Lin</h2>
                <p>畢業於高雄科技大學資訊管理系，行事風格習慣規劃後並踏實完成，大學期間曾任系學會副會長、系籃隊長、班級代表等職務，曾於高雄雙欣科技實習半年。
                </p>
            </div>
            <div>
                <h4>程式語言與框架經驗：</h4>
                <ul>
                    <li>擅長：PHP(Laravel)、SQL</li>
                    <li>架站伺服器：XAMPP</li>
                    <li>曾接觸學習：JS(react)、C++、Python、ASP.NET、Linux、Java</li>
                </ul>
                <hr />
            </div>

        </div>
    );
}

export default Intro;
