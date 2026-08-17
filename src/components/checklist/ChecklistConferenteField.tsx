import { ChecklistUserIcon } from "./ChecklistUiIcons";

type ChecklistConferenteFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function ChecklistConferenteField({
  id = "checklist-conferente-nome",
  value,
  onChange,
  disabled = false,
}: ChecklistConferenteFieldProps) {
  return (
    <div className="checklist-conferente">
      <label className="checklist-conferente__label" htmlFor={id}>
        Conferente
      </label>
      <div className="checklist-conferente__field">
        <ChecklistUserIcon size={16} className="checklist-conferente__icon" />
        <input
          id={id}
          required
          type="text"
          autoComplete="name"
          disabled={disabled}
          placeholder="Nome do responsável"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
