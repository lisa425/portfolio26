import { useTranslation } from "react-i18next";
import BtnBack from "./BtnBack";

interface InfoProps {
  onBack: () => void;
}

function Info({ onBack }: InfoProps) {
  const { t } = useTranslation();
  
  // Cast returnObjects to their expected types since t() returns unknown when using returnObjects
  const contact = t("info.contact", { returnObjects: true }) as any;
  const workExperience = t("info.workExperience", { returnObjects: true }) as any;
  const skills = t("info.skills", { returnObjects: true }) as any;
  const education = t("info.education", { returnObjects: true }) as any;

  return (
    <div className="inner info-inner">
      <header className="works-header">
        <BtnBack onClick={onBack} />
        <span className="works-title">Info</span>
      </header>

      <div className="info-content">
        <section className="info-bio">
          <h2 className="info-name">{t("info.name")}</h2>
          <p className="info-role">{t("info.role")}</p>
          <div className="info-contact">
            <span>📧 {contact.email}</span>
            <span style={{ margin: "0 10px" }}>|</span>
            <span>📞 {contact.phone}</span>
          </div>
        </section>

        <section className="info-details">
          <div className="info-block">
            <p className="info-block-body" style={{ lineHeight: 1.6 }}>{t("info.about")}</p>
          </div>

          <div className="info-block">
            <h3 className="info-block-title">{workExperience.title}</h3>
            {workExperience.jobs.map((job: any, jIdx: number) => (
              <div key={jIdx} className="job-entry" style={{ marginBottom: "2rem" }}>
                <h4 style={{ margin: "0 0 5px 0" }}>{job.company} | {job.role}</h4>
                <p style={{ margin: "0 0 15px 0", fontSize: "0.9em", opacity: 0.8 }}>
                  {job.period} | {job.location}
                </p>
                
                {job.projects.map((proj: any, pIdx: number) => (
                  <div key={pIdx} className="project-entry" style={{ marginBottom: "15px" }}>
                    <h5 style={{ margin: "0 0 5px 0" }}>■ {proj.name}</h5>
                    <ul style={{ margin: 0, paddingLeft: "20px", opacity: 0.9 }}>
                      {proj.bullets.map((bullet: string, bIdx: number) => (
                        <li key={bIdx} style={{ marginBottom: "4px" }}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="info-block">
            <h3 className="info-block-title">{skills.title}</h3>
            <div className="skills-grid" style={{ display: "grid", gap: "15px" }}>
              {skills.categories.map((cat: any, cIdx: number) => (
                <div key={cIdx}>
                  <strong style={{ display: "block", marginBottom: "5px" }}>■ {cat.name}</strong>
                  <span style={{ opacity: 0.9 }}>{cat.items}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="info-block">
            <h3 className="info-block-title">{education.title}</h3>
            <h4 style={{ margin: "0 0 5px 0" }}>{education.school}</h4>
            <p style={{ margin: "0 0 10px 0", fontSize: "0.9em", opacity: 0.8 }}>{education.period}</p>
            <ul style={{ margin: 0, paddingLeft: "20px", opacity: 0.9 }}>
              {education.bullets.map((bullet: string, eIdx: number) => (
                <li key={eIdx} style={{ marginBottom: "4px" }}>{bullet}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Info;
