import Validate from "./validate";

export default function NotNull(): PropertyDecorator {
  return (Validate as any)(value => 
    value !== null && 
    value !== undefined && 
    (typeof value !== "string" || value.trim() !== "")
  );
}
