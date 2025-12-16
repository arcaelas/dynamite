import {
  CreatedAt,
  CreationOptional,
  Default,
  Dynamite,
  PrimaryKey,
  Table,
  UpdatedAt,
} from "./index";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

(async function () {
  const dynamite = new Dynamite({ tables: [User] });
  await dynamite.connect();
  console.log("Connected successfully");
})();
