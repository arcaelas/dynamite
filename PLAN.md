# Dynamite ORM - Análisis de Testing

**Fecha:** 3 diciembre 2025
**Tests:** 125 ejecutados | 115 pasaron (92%) | 10 fallaron

---

## Métricas de Rendimiento

| Operación | Tiempo | Observación |
|-----------|--------|-------------|
| Query simple | 7.53ms | Aceptable |
| Query + 1 include | 12.33ms | 1.64x overhead |
| Query + 2 includes | 15.28ms | 2.03x overhead |
| Bulk create (200) | 739ms | 3.70ms/registro |
| Bulk update (100) | 245ms | 2.45ms/registro |
| Bulk delete (50) | 285ms | 5.71ms/registro |

### Pipeline
- Network: 60%
- Marshalling: 20%
- Unmarshalling: 20%

### Memoria
- Memory leak: -0.05MB (ninguno detectado)
- Batch loading: 75.9% más rápido que N+1

---

## Errores Detectados

### Críticos

| ID | Error | Causa |
|----|-------|-------|
| C1 | `limit: 0` retorna todos los registros | No se valida antes de query |
| C2 | Crash con `undefined` en filtros | DynamoDB SDK requiere `removeUndefinedValues` |
| C3 | Crash con array vacío en `in`/`not-in` | `ExpressionAttributeValues must not be empty` |
| C4 | Crash con proyección vacía | `ExpressionAttributeNames must not be empty` |

### Medios

| ID | Error | Causa |
|----|-------|-------|
| M1 | Operador `in` con 100 IDs retorna 0 | Formato de condición incorrecto |
| M2 | `contains` no encuentra `<>&` | Caracteres no escapados |
| M3 | Resultados inconsistentes entre queries | Diferencia en construcción de filtros |

### Simples

| ID | Error | Causa |
|----|-------|-------|
| S1 | GSIs no creados para HasMany | `sync()` no los genera |
| S2 | Validación en setter, no en save | Diseño de `@Validate` |

---

## Sugerencias de Código

### Fix C1: Validar limit
```typescript
// src/core/table.ts ~línea 440
if (options?.limit === 0) return [];
```

### Fix C2: Ignorar undefined
```typescript
// src/core/table.ts línea 458
scanParams.ExpressionAttributeValues = marshall(values, {
  removeUndefinedValues: true
});
```

### Fix C3: Manejar arrays vacíos
```typescript
// src/core/table.ts en buildConditionExpression
if (Array.isArray(value.in) && value.in.length === 0) return [];
if (Array.isArray(value["not-in"]) && value["not-in"].length === 0) {
  delete filters[key]; // No filtrar nada
}
```

### Fix M1: Chunked IN
```typescript
// Dividir arrays grandes en chunks de 25
async whereIn(key: string, values: any[]) {
  const results = [];
  for (let i = 0; i < values.length; i += 25) {
    const chunk = values.slice(i, i + 25);
    results.push(...await this.where({ [key]: { in: chunk } }));
  }
  return results;
}
```

---

## Oportunidades de Mejora

1. **GSIs automáticos** - `sync()` debería crear índices para foreign keys de relaciones HasMany
2. **Validación lazy** - Opción `@Validate(fn, { lazy: true })` para validar en `save()` en vez de setter
3. **Soft delete nativo** - Decorador `@SoftDelete` con campo `deleted_at`
4. **Transacciones** - Wrapper para operaciones atómicas múltiples
5. **Cursor pagination** - Alternativa a skip/limit usando `LastEvaluatedKey`

---

## Opinión Personal

**Lo bueno:** La arquitectura base es sólida. Decoradores bien implementados, relaciones funcionan, no hay memory leaks, batch loading efectivo.

**Lo preocupante:** Los crashes silenciosos con edge cases son peligrosos. Un `limit: 0` o un array vacío no debería tumbar la aplicación.

**Deuda técnica:** La validación eager limita patrones de formularios. Sin GSIs automáticos, las queries de relaciones escalan mal en tablas grandes.

**Prioridad sugerida:**
1. Fixes C1-C4 (30 minutos total, evitan crashes)
2. Fix M1 (2-4 horas, restaura funcionalidad crítica)
3. GSIs automáticos (4-8 horas, mejora escalabilidad)

---

## Próximos Tests

- [ ] Fase 14: Relaciones 5 niveles profundidad
- [ ] Fase 15: null/undefined exhaustivo
- [ ] Fase 17: Stress test 20k+ registros
