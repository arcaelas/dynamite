import {
  Dynamite, Table, PrimaryKey, Default, NotNull,
  CreationOptional, NonAttribute, Name,
  HasMany, HasOne, BelongsTo, ManyToMany,
} from "../index";

// -- 4 niveles: Org -> Dept -> Employee -> Task --

@Name('test_rel_orgs')
class Org extends Table<Org> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @NotNull() declare name: string;
  @HasMany(() => Dept, 'org_id', 'id')
  declare departments: NonAttribute<Dept[]>;
}

@Name('test_rel_depts')
class Dept extends Table<Dept> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @NotNull() declare name: string;
  @Default('') declare org_id: string;
  @BelongsTo(() => Org, 'id', 'org_id')
  declare org: NonAttribute<Org>;
  @HasMany(() => Employee, 'dept_id', 'id')
  declare employees: NonAttribute<Employee[]>;
}

@Name('test_rel_employees')
class Employee extends Table<Employee> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @NotNull() declare name: string;
  @Default('') declare dept_id: string;
  @BelongsTo(() => Dept, 'id', 'dept_id')
  declare department: NonAttribute<Dept>;
  @HasMany(() => EmpTask, 'employee_id', 'id')
  declare tasks: NonAttribute<EmpTask[]>;
  @ManyToMany(() => Project, 'test_rel_emp_projects', 'employee_id', 'project_id')
  declare projects: NonAttribute<Project[]>;
}

@Name('test_rel_tasks')
class EmpTask extends Table<EmpTask> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @NotNull() declare title: string;
  @Default('') declare employee_id: string;
  @BelongsTo(() => Employee, 'id', 'employee_id')
  declare employee: NonAttribute<Employee>;
}

@Name('test_rel_projects')
class Project extends Table<Project> {
  @PrimaryKey()
  declare id: CreationOptional<string>;
  @NotNull() declare name: string;
  @ManyToMany(() => Employee, 'test_rel_emp_projects', 'project_id', 'employee_id')
  declare members: NonAttribute<Employee[]>;
}

let passed = 0;
let failed = 0;
function assert(label: string, condition: boolean, detail?: string) {
  if (condition) { console.log(`  OK  ${label}`); passed++; }
  else { console.error(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); failed++; }
}

export default async function relations() {
  console.log('\n=== RELATIONS ===\n');

  const dynamite = new Dynamite({
    tables: [Org, Dept, Employee, EmpTask, Project],
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  await dynamite.connect();
  await dynamite.sync();

  // -- Seed data --
  const org = await Org.create({ name: 'Acme Corp' });
  const eng = await Dept.create({ name: 'Engineering', org_id: org.id });
  const sales = await Dept.create({ name: 'Sales', org_id: org.id });

  const e1 = await Employee.create({ name: 'Alice', dept_id: eng.id });
  const e2 = await Employee.create({ name: 'Bob', dept_id: eng.id });
  const e3 = await Employee.create({ name: 'Charlie', dept_id: sales.id });

  await EmpTask.create({ title: 'Build API', employee_id: e1.id });
  await EmpTask.create({ title: 'Write tests', employee_id: e1.id });
  await EmpTask.create({ title: 'Code review', employee_id: e2.id });
  await EmpTask.create({ title: 'Close deal', employee_id: e3.id });

  const p1 = await Project.create({ name: 'Project Alpha' });
  const p2 = await Project.create({ name: 'Project Beta' });

  // -- HasMany --
  console.log('-- HasMany --');
  const org_with_depts = await Org.where({ id: org.id }, { include: { departments: true } });
  assert('Org -> departments', org_with_depts[0]?.departments?.length === 2);

  const eng_with_emps = await Dept.where({ id: eng.id }, { include: { employees: true } });
  assert('Dept -> employees', eng_with_emps[0]?.employees?.length === 2);

  // -- BelongsTo --
  console.log('\n-- BelongsTo --');
  const dept_with_org = await Dept.where({ id: eng.id }, { include: { org: true } });
  assert('Dept -> org', dept_with_org[0]?.org?.name === 'Acme Corp');

  const emp_with_dept = await Employee.where({ id: e1.id }, { include: { department: true } });
  assert('Employee -> department', emp_with_dept[0]?.department?.name === 'Engineering');

  // -- HasMany con opciones (limit) --
  console.log('\n-- HasMany con opciones --');
  const e1_tasks_limited = await Employee.where({ id: e1.id }, {
    include: { tasks: { limit: 1 } }
  });
  assert('HasMany con limit:1', e1_tasks_limited[0]?.tasks?.length === 1);

  // -- Include recursivo 2 niveles: Org -> Dept -> Employee --
  console.log('\n-- Include recursivo 2 niveles --');
  const org_2lvl = await Org.where({ id: org.id }, {
    include: {
      departments: {
        include: { employees: true }
      }
    }
  });
  const all_emps = org_2lvl[0]?.departments?.flatMap((d: any) => d.employees || []);
  assert('Org -> Dept -> Employee (2 niveles)', all_emps?.length === 3);

  // -- Include recursivo 3 niveles: Org -> Dept -> Employee -> Task --
  console.log('\n-- Include recursivo 3 niveles --');
  const org_3lvl = await Org.where({ id: org.id }, {
    include: {
      departments: {
        include: {
          employees: {
            include: { tasks: true }
          }
        }
      }
    }
  });
  const eng_dept = org_3lvl[0]?.departments?.find((d: any) => d.name === 'Engineering');
  const alice = eng_dept?.employees?.find((e: any) => e.name === 'Alice');
  assert('3 niveles: Alice tiene 2 tasks', alice?.tasks?.length === 2);
  const bob = eng_dept?.employees?.find((e: any) => e.name === 'Bob');
  assert('3 niveles: Bob tiene 1 task', bob?.tasks?.length === 1);
  const sales_dept = org_3lvl[0]?.departments?.find((d: any) => d.name === 'Sales');
  const charlie = sales_dept?.employees?.find((e: any) => e.name === 'Charlie');
  assert('3 niveles: Charlie tiene 1 task', charlie?.tasks?.length === 1);

  // -- ManyToMany: attach --
  console.log('\n-- ManyToMany --');
  await e1.attach(Project, p1.id);
  await e1.attach(Project, p2.id);
  await e2.attach(Project, p1.id);

  const e1_projects = await Employee.where({ id: e1.id }, { include: { projects: true } });
  assert('attach: Alice tiene 2 projects', e1_projects[0]?.projects?.length === 2);

  const p1_members = await Project.where({ id: p1.id }, { include: { members: true } });
  assert('attach: Project Alpha tiene 2 members', p1_members[0]?.members?.length === 2);

  // -- ManyToMany: detach --
  await e1.detach(Project, p2.id);
  const e1_after_detach = await Employee.where({ id: e1.id }, { include: { projects: true } });
  assert('detach: Alice tiene 1 project', e1_after_detach[0]?.projects?.length === 1);

  // -- ManyToMany: sync --
  await e1.sync(Project, [p2.id]);
  const e1_after_sync = await Employee.where({ id: e1.id }, { include: { projects: true } });
  assert('sync: Alice solo tiene Project Beta', e1_after_sync[0]?.projects?.length === 1);
  assert('sync: es Project Beta', e1_after_sync[0]?.projects?.[0]?.name === 'Project Beta');

  // -- Include recursivo 3 niveles + ManyToMany --
  console.log('\n-- Recursivo + ManyToMany --');
  const org_full = await Org.where({ id: org.id }, {
    include: {
      departments: {
        include: {
          employees: {
            include: { tasks: true, projects: true }
          }
        }
      }
    }
  });
  const eng_full = org_full[0]?.departments?.find((d: any) => d.name === 'Engineering');
  const alice_full = eng_full?.employees?.find((e: any) => e.name === 'Alice');
  assert('full tree: Alice tasks + projects', alice_full?.tasks?.length === 2 && alice_full?.projects?.length === 1);

  console.log(`\n  Relations: ${passed} passed, ${failed} failed`);
  return failed;
}
