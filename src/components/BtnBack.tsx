interface BtnBackProps {
  onClick: () => void;
  label?: string;
}

function BtnBack({ onClick, label = "Main" }: BtnBackProps) {
  return (
    <button className="btn-back" onClick={onClick}>
      {label}
    </button>
  );
}

export default BtnBack;
