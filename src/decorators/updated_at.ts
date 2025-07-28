import Mutate from "./mutate";

export default function UpdatedAt(): PropertyDecorator {
  return Mutate(() => new Date().toISOString());
}
