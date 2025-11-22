# UTEC Extractor - JSON Output Structure

This document describes the JSON structure produced by the UTEC Extractor for different extraction configurations.

## Recording Object Structure

Each recording is represented by the following object:

```json
{
  "weekNumber": 14,
  "subject": "Course Name - CS101",
  "seccion": "AB1",
  "fecha": "15/11/2025",
  "horaInicio": "08:00",
  "docente": "Professor Name",
  "tipo": "Teoría",
  "estado": "Grabado",
  "modalidad": "Virtual",
  "url": "https://utec-edu-pe.zoom.us/rec/share/...",
  "title": "Recording Title from Zoom",
  "timestamp": 1732233600000,
  "buttonId": "ver_12345"
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `weekNumber` | number | The week number (1-20) when this recording occurred |
| `subject` | string | Course name/code |
| `seccion` | string | Section identifier (e.g., "AB1", "CD2") |
| `fecha` | string | Date of the class in DD/MM/YYYY format |
| `horaInicio` | string | Start time in HH:MM format |
| `docente` | string | Professor/instructor name |
| `tipo` | string | Type of class (e.g., "Teoría", "Práctica", "Laboratorio") |
| `estado` | string | Recording status (e.g., "Grabado", "Pendiente") |
| `modalidad` | string | Class modality (e.g., "Virtual", "Presencial", "Híbrido") |
| `url` | string | Full Zoom recording URL |
| `title` | string | Recording title from Zoom tab |
| `timestamp` | number | Unix timestamp (milliseconds) when the recording was captured |
| `buttonId` | string | Internal button ID used for extraction (format: "ver_XXXXX") |

---

## 1. Single Week Extraction ("Extract This Week Only")

When extracting only the current week, the output is a simple array of recording objects.

### Filename Format
```
utec-recordings-week{weekNumber}-{dayName}-{date}.json
```
Example: `utec-recordings-week14-friday-2025-11-22.json`

### JSON Structure
```json
[
  {
    "weekNumber": 14,
    "subject": "Algoritmos y Estructuras de Datos",
    "seccion": "AB1",
    "fecha": "18/11/2025",
    "horaInicio": "08:00",
    "docente": "Juan Pérez",
    "tipo": "Teoría",
    "estado": "Grabado",
    "modalidad": "Virtual",
    "url": "https://utec-edu-pe.zoom.us/rec/share/abc123...",
    "title": "AED - Sesión 14.1",
    "timestamp": 1732233600000,
    "buttonId": "ver_10001"
  },
  {
    "weekNumber": 14,
    "subject": "Cálculo II",
    "seccion": "CD2",
    "fecha": "19/11/2025",
    "horaInicio": "10:00",
    "docente": "María García",
    "tipo": "Práctica",
    "estado": "Grabado",
    "modalidad": "Virtual",
    "url": "https://utec-edu-pe.zoom.us/rec/share/def456...",
    "title": "Cálculo II - Práctica 14",
    "timestamp": 1732320000000,
    "buttonId": "ver_10002"
  }
]
```

---

## 2. All Weeks Extraction (Week N to Week 1) - With Metadata

When extracting all weeks with the "Include metadata" setting enabled (default).

### Filename Format
```
utec-recordings-all-weeks-{periodo}-{dayName}-{date}.json
```
Example: `utec-recordings-all-weeks-2025-1-friday-2025-11-22.json`

### JSON Structure
```json
{
  "extractionDate": "2025-11-22",
  "extractionDay": "friday",
  "periodo": "2025 - 1",
  "totalRecordings": 42,
  "totalWeeks": 14,
  "weeks": {
    "14": [
      {
        "weekNumber": 14,
        "subject": "Algoritmos y Estructuras de Datos",
        "seccion": "AB1",
        "fecha": "18/11/2025",
        "horaInicio": "08:00",
        "docente": "Juan Pérez",
        "tipo": "Teoría",
        "estado": "Grabado",
        "modalidad": "Virtual",
        "url": "https://utec-edu-pe.zoom.us/rec/share/abc123...",
        "title": "AED - Sesión 14.1",
        "timestamp": 1732233600000,
        "buttonId": "ver_10001"
      }
    ],
    "13": [
      {
        "weekNumber": 13,
        "subject": "Cálculo II",
        "seccion": "CD2",
        "fecha": "11/11/2025",
        "horaInicio": "10:00",
        "docente": "María García",
        "tipo": "Teoría",
        "estado": "Grabado",
        "modalidad": "Virtual",
        "url": "https://utec-edu-pe.zoom.us/rec/share/ghi789...",
        "title": "Cálculo II - Sesión 13",
        "timestamp": 1731321600000,
        "buttonId": "ver_10003"
      }
    ],
    "12": [],
    "11": [
      {
        "weekNumber": 11,
        "subject": "Física I",
        "seccion": "EF3",
        "fecha": "28/10/2025",
        "horaInicio": "14:00",
        "docente": "Carlos López",
        "tipo": "Laboratorio",
        "estado": "Grabado",
        "modalidad": "Híbrido",
        "url": "https://utec-edu-pe.zoom.us/rec/share/jkl012...",
        "title": "Física I - Lab 11",
        "timestamp": 1730116800000,
        "buttonId": "ver_10004"
      }
    ],
    "...": "... more weeks ...",
    "1": [
      {
        "weekNumber": 1,
        "subject": "Introducción a la Programación",
        "seccion": "GH4",
        "fecha": "19/08/2025",
        "horaInicio": "08:00",
        "docente": "Ana Torres",
        "tipo": "Teoría",
        "estado": "Grabado",
        "modalidad": "Virtual",
        "url": "https://utec-edu-pe.zoom.us/rec/share/mno345...",
        "title": "IP - Sesión Inaugural",
        "timestamp": 1724054400000,
        "buttonId": "ver_10005"
      }
    ]
  }
}
```

### Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `extractionDate` | string | Date of extraction in YYYY-MM-DD format |
| `extractionDay` | string | Day name in lowercase (e.g., "friday", "monday") |
| `periodo` | string | Academic period (e.g., "2025 - 1", "2024 - 2") |
| `totalRecordings` | number | Total count of all recordings across all weeks |
| `totalWeeks` | number | Number of weeks that have data |
| `weeks` | object | Object with week numbers as keys and arrays of recordings as values |

---

## 3. All Weeks Extraction - Without Metadata

When "Include metadata" setting is disabled.

### Filename Format
Same as with metadata:
```
utec-recordings-all-weeks-{periodo}-{dayName}-{date}.json
```

### JSON Structure
```json
{
  "14": [
    {
      "weekNumber": 14,
      "subject": "Algoritmos y Estructuras de Datos",
      "seccion": "AB1",
      "fecha": "18/11/2025",
      "horaInicio": "08:00",
      "docente": "Juan Pérez",
      "tipo": "Teoría",
      "estado": "Grabado",
      "modalidad": "Virtual",
      "url": "https://utec-edu-pe.zoom.us/rec/share/abc123...",
      "title": "AED - Sesión 14.1",
      "timestamp": 1732233600000,
      "buttonId": "ver_10001"
    }
  ],
  "13": [
    {
      "weekNumber": 13,
      "subject": "Cálculo II",
      "seccion": "CD2",
      "fecha": "11/11/2025",
      "horaInicio": "10:00",
      "docente": "María García",
      "tipo": "Teoría",
      "estado": "Grabado",
      "modalidad": "Virtual",
      "url": "https://utec-edu-pe.zoom.us/rec/share/ghi789...",
      "title": "Cálculo II - Sesión 13",
      "timestamp": 1731321600000,
      "buttonId": "ver_10003"
    }
  ],
  "12": [],
  "1": [
    {
      "weekNumber": 1,
      "subject": "Introducción a la Programación",
      "seccion": "GH4",
      "fecha": "19/08/2025",
      "horaInicio": "08:00",
      "docente": "Ana Torres",
      "tipo": "Teoría",
      "estado": "Grabado",
      "modalidad": "Virtual",
      "url": "https://utec-edu-pe.zoom.us/rec/share/mno345...",
      "title": "IP - Sesión Inaugural",
      "timestamp": 1724054400000,
      "buttonId": "ver_10005"
    }
  ]
}
```

---

## 4. Custom Week Range Extraction (Interval)

When using the "Custom week range" setting (e.g., Week 14 to Week 10).

The structure is **identical** to "All Weeks Extraction" but only includes the specified range of weeks.

### Example: Week 14 to Week 10 (With Metadata)

```json
{
  "extractionDate": "2025-11-22",
  "extractionDay": "friday",
  "periodo": "2025 - 1",
  "totalRecordings": 15,
  "totalWeeks": 5,
  "weeks": {
    "14": [
      {
        "weekNumber": 14,
        "subject": "Algoritmos y Estructuras de Datos",
        "seccion": "AB1",
        "fecha": "18/11/2025",
        "horaInicio": "08:00",
        "docente": "Juan Pérez",
        "tipo": "Teoría",
        "estado": "Grabado",
        "modalidad": "Virtual",
        "url": "https://utec-edu-pe.zoom.us/rec/share/abc123...",
        "title": "AED - Sesión 14.1",
        "timestamp": 1732233600000,
        "buttonId": "ver_10001"
      },
      {
        "weekNumber": 14,
        "subject": "Cálculo II",
        "seccion": "CD2",
        "fecha": "19/11/2025",
        "horaInicio": "10:00",
        "docente": "María García",
        "tipo": "Práctica",
        "estado": "Grabado",
        "modalidad": "Virtual",
        "url": "https://utec-edu-pe.zoom.us/rec/share/def456...",
        "title": "Cálculo II - Práctica 14",
        "timestamp": 1732320000000,
        "buttonId": "ver_10002"
      }
    ],
    "13": [
      {
        "weekNumber": 13,
        "subject": "Física I",
        "seccion": "EF3",
        "fecha": "12/11/2025",
        "horaInicio": "14:00",
        "docente": "Carlos López",
        "tipo": "Laboratorio",
        "estado": "Grabado",
        "modalidad": "Híbrido",
        "url": "https://utec-edu-pe.zoom.us/rec/share/jkl012...",
        "title": "Física I - Lab 13",
        "timestamp": 1731412800000,
        "buttonId": "ver_10006"
      }
    ],
    "12": [],
    "11": [
      {
        "weekNumber": 11,
        "subject": "Programación II",
        "seccion": "AB1",
        "fecha": "29/10/2025",
        "horaInicio": "08:00",
        "docente": "Luis Martínez",
        "tipo": "Teoría",
        "estado": "Grabado",
        "modalidad": "Virtual",
        "url": "https://utec-edu-pe.zoom.us/rec/share/pqr678...",
        "title": "Prog II - Sesión 11",
        "timestamp": 1730203200000,
        "buttonId": "ver_10007"
      }
    ],
    "10": [
      {
        "weekNumber": 10,
        "subject": "Base de Datos",
        "seccion": "IJ5",
        "fecha": "22/10/2025",
        "horaInicio": "16:00",
        "docente": "Rosa Sánchez",
        "tipo": "Práctica",
        "estado": "Grabado",
        "modalidad": "Virtual",
        "url": "https://utec-edu-pe.zoom.us/rec/share/stu901...",
        "title": "BD - Práctica SQL",
        "timestamp": 1729598400000,
        "buttonId": "ver_10008"
      }
    ]
  }
}
```

---

## TypeScript Type Definitions

For developers working with this data, here are TypeScript type definitions:

```typescript
// Single recording object
interface Recording {
  weekNumber: number;
  subject: string;
  seccion: string;
  fecha: string;
  horaInicio: string;
  docente: string;
  tipo: string;
  estado: string;
  modalidad: string;
  url: string;
  title: string;
  timestamp: number;
  buttonId: string;
}

// Single week extraction output
type SingleWeekOutput = Recording[];

// All weeks without metadata
interface WeeksData {
  [weekNumber: string]: Recording[];
}

// All weeks with metadata
interface AllWeeksWithMetadata {
  extractionDate: string;      // "YYYY-MM-DD"
  extractionDay: string;       // lowercase day name
  periodo: string;             // "YYYY - N"
  totalRecordings: number;
  totalWeeks: number;
  weeks: WeeksData;
}

// Possible output types
type ExtractorOutput = SingleWeekOutput | WeeksData | AllWeeksWithMetadata;
```

---

## Notes

1. **Empty weeks**: Weeks with no recordings are included as empty arrays (`[]`) in multi-week extractions.

2. **Week ordering**: Week keys are strings but represent numbers. When iterating, convert to numbers and sort descending for chronological order (newest first).

3. **URL format**: Zoom URLs follow the pattern `https://utec-edu-pe.zoom.us/rec/share/{shareId}...` and may include additional query parameters.

4. **Timestamps**: All timestamps are in milliseconds since Unix epoch (JavaScript `Date.now()` format).

5. **Character encoding**: All text fields are UTF-8 encoded. Spanish characters (á, é, í, ó, ú, ñ) are preserved.

6. **Day names**: The `extractionDay` field uses lowercase English day names: `sunday`, `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`.
