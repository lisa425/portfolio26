/**
 * 패널 모서리의 4-코너 장식 프레임.
 * 부모가 position: relative여야 하고, 색은 부모에서 CSS 변수
 * `--corner-color`로 조절한다 (기본 rgba(255,255,255,0.6) — App.scss `.corner`).
 */
function Corners() {
  return (
    <>
      <span className="corner top-left"></span>
      <span className="corner top-right"></span>
      <span className="corner bottom-left"></span>
      <span className="corner bottom-right"></span>
    </>
  );
}

export default Corners;
