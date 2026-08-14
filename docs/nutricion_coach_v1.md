# Módulo de Nutrición — Vista Coach

> **Histórico / superseded.** Draft de diseño previo a la implementación.
> **V estable — 2026-08-13:** perfil nutricional + pauta (list/read/archive) en `#nutrition-view` (tabs Perfil | Pauta + `coach-athlete-picker`);
> vista atleta en `#athlete-nutrition-view`. Create/edit editor = siguiente. Ver `docs/FRONTEND-CAPACIDADES.md` (§9c/9d) y `docs/TODO.md`.

## Objetivo inicial

Crear una primera versión del módulo de nutrición enfocada exclusivamente en el coach.

La idea es que el coach entre a la sección **Nutrición**, seleccione un atleta y pueda trabajar sobre su información para definir una pauta alimentaria.

Más adelante, esta información podrá mostrarse en un módulo propio dentro de la vista del atleta.

---

## Datos del atleta disponibles actualmente

Al seleccionar un atleta, hoy ya contamos con:

- Nombre
- Apellido
- Fecha de nacimiento
- Peso actual
- Objetivo
- Altura
- Sexo

Estos datos sirven como contexto, pero no son suficientes por sí solos para construir una pauta alimentaria completa.

---

# Propuesta de estructura para la vista del coach

La vista podría dividirse en cuatro bloques principales:

1. Resumen del atleta
2. Perfil nutricional
3. Objetivos nutricionales
4. Pauta alimentaria

---

# 1. Resumen del atleta

En la parte superior de la vista mostrar una ficha resumida con los datos que ya existen.

Ejemplo:

```text
ATLETA
Nicolás Estrada
30 años · 82 kg · 172 cm
Objetivo: pérdida de grasa
Sexo: Masculino
```

La idea es que esta sección sea principalmente informativa y no editable desde Nutrición.

---

# 2. Perfil nutricional

Aquí el coach completa la información que falta para poder trabajar mejor la pauta.

## Actividad diaria

Evitar usar únicamente un selector genérico como:

```text
Actividad: baja / media / alta
```

porque puede ser demasiado subjetivo.

Es mejor recopilar información más concreta.

### Datos posibles

- Tipo de trabajo o actividad diaria
  - Sedentario
  - Mayormente de pie
  - Activo
  - Trabajo físicamente demandante

- Entrenamientos por semana
- Duración promedio del entrenamiento
- Pasos diarios aproximados
- Cardio semanal
- Actividad adicional

Ejemplo:

```text
Actividad diaria       [ Sedentaria ▼ ]
Entrenamientos/semana  [ 4 ]
Duración promedio      [ 75 min ]
Pasos diarios          [ 6500 ]
Cardio semanal         [ 60 min ]
```

---

## Hábitos alimentarios

Información útil para adaptar la pauta a la vida real del atleta.

### Datos posibles

- Cantidad de comidas preferidas al día
- Horarios habituales
- Hora de entrenamiento
- Si entrena en ayunas o después de comer

Ejemplo:

```text
Comidas por día         [ 4 ]
Desayuno                [ 08:00 ]
Almuerzo                [ 13:30 ]
Colación                [ 17:30 ]
Cena                    [ 21:00 ]
Hora de entrenamiento   [ 18:30 ]
```

---

## Preferencias alimentarias

El coach debería poder registrar:

- Alimentos que le gustan al atleta
- Alimentos que no le gustan
- Alimentos que evita
- Preferencias generales

Ejemplo:

```text
Preferencias
[ Pollo ] [ Arroz ] [ Huevos ] [ + Agregar ]

Alimentos que evita
[ Pescado ] [ Brócoli ] [ + Agregar ]
```

---

## Restricciones y observaciones

Agregar campos para registrar información relevante.

### Posibles campos

- Tipo de alimentación
  - Sin restricciones
  - Vegetariana
  - Vegana
  - Otra

- Restricciones alimentarias
- Alergias
- Intolerancias
- Observaciones generales

Ejemplo:

```text
Restricciones           [ + Agregar ]
Observaciones            [............................]
```

---

# 3. Objetivos nutricionales

Una vez completado el perfil, la aplicación puede ayudar al coach con cálculos y sugerencias.

La lógica recomendada es:

> La app sugiere → el coach decide.

No conviene que la aplicación imponga automáticamente las calorías o los macros.

---

## Datos calculados o sugeridos

Podrían mostrarse:

- TMB estimada
- Gasto diario estimado
- Calorías de mantenimiento estimadas
- Calorías objetivo sugeridas
- Proteína sugerida
- Carbohidratos sugeridos
- Grasas sugeridas

Ejemplo:

```text
OBJETIVOS

Mantenimiento estimado
2.650 kcal

Calorías objetivo
[ 2.200 kcal ]

Proteína
[ 170 g ]

Carbohidratos
[ 230 g ]

Grasas
[ 65 g ]
```

---

## Valores sugeridos vs valores asignados

Sería útil diferenciar entre lo que calcula la aplicación y lo que finalmente decide el coach.

Ejemplo:

```text
Proteína sugerida
165–180 g

Proteína asignada
[ 170 g ]
```

Esto mantiene al coach en control.

---

# 4. Pauta alimentaria

Para la primera versión, la recomendación es crear una pauta flexible y estructurada, sin implementar todavía una base de alimentos completa.

## Ejemplo de una comida

```text
DESAYUNO
08:00

3 huevos
2 rebanadas de pan integral
1 fruta

Notas:
Evitar agregar aceite.
```

El coach debería poder agregar tantas comidas como necesite.

Ejemplo:

```text
PAUTA

Desayuno
Almuerzo
Colación
Cena

[ + Agregar comida ]
```

---

# Dos posibles caminos para implementar la pauta

## Opción A — Pauta libre

El coach escribe manualmente las comidas, cantidades y observaciones.

### Ventajas

- Mucho más rápida de implementar
- Flexible
- Permite validar cómo trabajan realmente los coaches
- No requiere una base de alimentos desde el principio

### Desventajas

- La aplicación no puede calcular automáticamente las calorías y macros de cada comida

---

## Opción B — Constructor nutricional completo

El coach selecciona alimentos, cantidades y la app calcula automáticamente kcal y macros.

Ejemplo:

```text
DESAYUNO
08:00

Alimento                Cantidad
Huevos                  3 unidades
Pan integral            80 g
Leche descremada        200 ml

Total comida
515 kcal
P: 32 g
C: 48 g
G: 20 g
```

Mientras el coach agrega alimentos, se podría mostrar un resumen diario:

```text
TOTAL DEL DÍA

2.140 / 2.200 kcal

Proteína
171 / 170 g

Carbohidratos
226 / 230 g

Grasas
61 / 65 g
```

### Ventajas

- Mucho más potente
- Permite cálculos en tiempo real
- Mejor experiencia para el coach
- Facilita equivalencias y alternativas

### Desventajas

- Requiere una base de alimentos
- Mayor complejidad de desarrollo
- Más trabajo de UX y backend

---

# Recomendación para V1

Comenzar con:

## Perfil nutricional

- Objetivo
- Peso
- Altura
- Actividad diaria
- Entrenamientos por semana
- Pasos diarios
- Restricciones
- Preferencias
- Horarios

## Objetivos

- Calorías
- Proteína
- Carbohidratos
- Grasas

## Pauta

- Nombre de comida
- Hora
- Texto libre o descripción
- Cantidades escritas por el coach
- Notas
- Agregar / eliminar comidas

La idea es validar primero cómo usa realmente la herramienta un coach.

---

# Posible evolución futura

## V2

- Base de alimentos
- Cantidades estructuradas
- Calorías automáticas
- Macros automáticos
- Varias opciones por comida
- Equivalencias de alimentos

## V3

- Historial de pautas
- Seguimiento de peso
- Seguimiento de adherencia
- Ajustes de calorías por período
- Comparación entre pauta y progreso
- Integración con análisis de fotos
- Recomendaciones asistidas por IA

---

# Vista futura del atleta

La vista del atleta debería ser mucho más simple que la del coach.

El coach necesita editar y configurar.

El atleta principalmente necesita consultar.

Ejemplo:

```text
MI PAUTA

Objetivo: 2.200 kcal

Desayuno
08:00
3 huevos
2 panes integrales
200 ml leche

Almuerzo
13:30
200 g pollo
150 g arroz
Ensalada

Colación
17:30
...

Cena
21:00
...
```

---

# Idea de flujo general

```text
Coach entra a Nutrición
        ↓
Selecciona atleta
        ↓
Ve resumen del atleta
        ↓
Completa perfil nutricional
        ↓
La aplicación calcula sugerencias
        ↓
Coach define calorías y macros
        ↓
Coach crea pauta
        ↓
Guarda pauta
        ↓
Atleta puede verla desde su módulo
```

---

# Principio de diseño recomendado

Separar claramente:

- Datos existentes del atleta
- Datos nutricionales ingresados por el coach
- Cálculos realizados por la aplicación
- Decisiones finales del coach
- Pauta visible para el atleta

La aplicación debe ayudar al coach, no reemplazar sus decisiones.

---

# Primera decisión a tomar

Antes de desarrollar la vista completa, definir si la primera versión será:

### A. Pauta libre

El coach escribe comidas y cantidades manualmente.

### B. Constructor nutricional completo

El coach selecciona alimentos, gramos y la aplicación calcula macros y calorías.

## Recomendación

Comenzar con **A + cálculo simple de calorías/macros** y diseñar el modelo de datos pensando en evolucionar a B posteriormente.
