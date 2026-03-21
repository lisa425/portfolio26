import BtnBack from "./BtnBack";

interface InfoProps {
  onBack: () => void;
}

function Info({ onBack }: InfoProps) {
  return (
    <div className="inner info-inner">
      <header className="works-header">
        <BtnBack onClick={onBack} />
        <span className="works-title">Info</span>
      </header>

      <div className="info-content">
        {/* placeholder — 실제 내용 채워넣을 예정 */}
        <section className="info-bio">
          <h2 className="info-name">Chaewon Im</h2>
          <p className="info-role">Frontend Engineer · Creative Developer</p>
        </section>

        <section className="info-details">
          <div className="info-block">
            <h3 className="info-block-title">About</h3>
            <p className="info-block-body">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            </p>
          </div>
          <div className="info-block">
            <h3 className="info-block-title">Skills</h3>
            <ul className="info-list">
              {["React", "TypeScript", "Three.js", "GSAP", "SCSS"].map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="info-block">
            <h3 className="info-block-title">Contact</h3>
            <ul className="info-list">
              <li>email@example.com</li>
              <li>github.com/username</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Info;
