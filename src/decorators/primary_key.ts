import Index from "./index";
import IndexSort from "./index_sort";

export default function PrimaryKey(name = "primary"): PropertyDecorator {
  if (typeof name !== "string" || !name.trim()) {
    throw new TypeError("@PrimaryKey requiere un nombre de índice válido");
  }
  return (target: object, prop: string | symbol): void => {
    Index()(target, prop);
    IndexSort()(target, prop);
  };
}
