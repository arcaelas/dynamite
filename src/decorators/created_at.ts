import Default from "./default";

export default function CreatedAt(): PropertyDecorator {
  return Default(() => new Date().toISOString());
}
