# Gravitate Health Preprocessing Service - AI Agent Instructions

## Project Overview
This is a **Gravitate Health ePI (electronic Product Information) preprocessing microservice** that adds semantic annotations to Package Leaflet sections in HL7 FHIR format. The service is designed as an internal Kubernetes service within the Gravitate Health infrastructure, accessed via the Focusing Manager.

**Core purpose**: Receive an ePI document, scan Package Leaflet HTML for medical terminology, annotate matching text with CSS classes linked to SNOMED/medical codes, and return the enhanced ePI with code extensions.

## Architecture & Data Flow

### Request/Response Pattern
- **Single endpoint**: `POST /preprocess` - receives complete ePI JSON (FHIR Bundle), returns annotated version
- **Input**: `epi.entry[0].resource.section[0].section[]` - nested Package Leaflet sections with HTML `div` fields
- **Output**: Same structure with annotated HTML + code extensions in `epi.entry[0].resource.extension[]`
- **External dependency**: `process.env.TERM_SERVER_URL` - terminology server providing SNOMED/medical codes

### Processing Pipeline (see `src/controllers/preprocessing.ts`)
1. Extract language from `epi.entry[0].resource.language` → builds `descr_<lang>` key (e.g., `descr_en`)
2. Fetch all codes from terminology server endpoints (currently just `/codes/all`)
3. Recursively walk Package Leaflet sections:
   - For each section's HTML `div`, parse with `jsdom` DOM manipulation
   - Case-insensitive substring matching against code descriptions
   - Wrap matching text in `<span class="CODE_ID [SYNONYM_ID]">` tags
   - Track matched codes in `codesFound[]` array
4. Add `HtmlElementLink` extensions to ePI resource with matched codes
5. Update category from `"R"` (Raw) to `"P"` (Preprocessed)

### Key Technical Details
- **HTML manipulation**: Uses `jsdom` for DOM parsing/modification (not regex replacement)
- **Recursive processing**: `addSemmanticAnnotation()` handles nested section hierarchies
- **Text search**: `recursiveTreeWalker()` finds text nodes containing code descriptions
- **Class merging**: Preserves existing CSS classes when adding annotations
- **Synonym handling**: Codes can have `synonyms` object - both IDs added as CSS classes

## Critical Patterns & Conventions

### Logger Usage
**Always use the custom Logger utility** instead of `console.*`:
```typescript
import { Logger } from '../utils/Logger';
Logger.logInfo('filename.ts', 'functionName', 'message');
Logger.logDebug('filename.ts', 'functionName', () => `Expensive: ${JSON.stringify(data)}`);
```
- Function messages (lambdas) are only evaluated if log level permits
- Format: `timestamp - LEVEL - file - task - message`
- Controlled by `process.env.LOG_LEVEL` (DEBUG/INFO/WARN/ERROR/FATAL)

### Error Handling Strategy
Return HTTP status codes with simple string messages (see `preprocess()` controller):
- `400` - Malformed ePI payload (e.g., missing expected structure)
- `500` - Terminology server failure or processing errors
- `200` - Success with modified ePI JSON body

### Environment Variables
- `SERVER_PORT` (default: 3000) - HTTP server port
- `LOG_LEVEL` (default: INFO) - Logger verbosity
- `TERM_SERVER_URL` - **Required** - terminology server base URL (e.g., `http://fosps.gravitatehealth.eu/terminologies`)

## Development Workflows

### Local Development
```bash
npm install           # Install dependencies
npm run dev          # Run with ts-node-dev (hot reload on port 3000)
npm run build        # Compile TypeScript to build/
npm start            # Run compiled JS from build/index.js
```

### Testing the Service
```bash
# Start service
npm run dev

# Send test request (requires valid ePI JSON)
curl -X POST http://localhost:3000/preprocess \
  -H "Content-Type: application/json" \
  -d @test-epi.json
```

### Docker Build & Run
```bash
docker build -t preprocessing-service .
docker run -p 3000:3000 \
  -e TERM_SERVER_URL=http://terminology-server:8080 \
  preprocessing-service
```
**Note**: Container runs as non-root `node` user with `--max-old-space-size=4096` for memory management.

## Kubernetes Deployment

### Service Discovery Label
The service **must** include this label for discovery by the Focusing Manager:
```yaml
metadata:
  labels:
    eu.gravitate-health.fosps.preprocessing: "true"
```

### Internal Access Only
- Type: `ClusterIP` (no external ingress)
- Access URL: `http://preprocessing-service-mvp2.default.svc.cluster.local:3000/preprocess`

### Deployment Pattern
1. Images published to GHCR: `ghcr.io/<github_username>/<repo_name>`
2. Automated via `.github/workflows/docker-image.yml` (tags `latest` on push)
3. Kustomize overlays: `kubernetes/base/` + `kubernetes/dev/` for environment variants

## Key Files Reference
- `src/controllers/preprocessing.ts` - Main annotation logic (500+ lines)
- `src/utils/Logger.ts` - Custom logging with level control
- `src/index.ts` - Express server setup (3000 port, 10mb JSON limit)
- `src/routes/preprocessing.ts` - Single POST route binding
- `openapi.yaml` - API contract (generic object schemas)
- `Dockerfile` - Multi-stage build with non-root user

## Common Modifications

### Adding New Terminology Sources
Edit `snomedEndpointList` array in `preprocessing.ts`:
```typescript
const snomedEndpointList = ['codes', 'new-endpoint'];
```

### Changing Annotation Format
Modify `annotationProcess()` and `codeToExtension()` functions to alter:
- CSS class structure on `<span>` elements
- FHIR extension format in output

### Adjusting Code System Mappings
Update switch statement in `preprocess()` for new code systems:
```typescript
case "new-system":
    codeSystemUrl = "http://new-system.org/codes"
    break
```

## TypeScript Configuration Notes
- Target: ES6 compiled to CommonJS
- Strict mode enabled
- Output: `./build` directory
- JSON import support enabled for data files
