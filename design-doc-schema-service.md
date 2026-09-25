# Serviço de Documentos com Schema Customizável — Documento de Design

## 1. Visão geral do projeto

A ideia central é um serviço onde uma conta pode **definir a estrutura de um dado** (via JSON
Schema), criar **pastas** que seguem essa estrutura, e dentro dessas pastas armazenar
**documentos** (instâncias JSON validadas contra o schema). Cada documento ou pasta pode gerar
**tokens de acesso** com permissões granulares (de "só listar" até "deletar"), permitindo
compartilhar dados com terceiros sem precisar de conta no sistema.

Pense nele como um meio-termo entre:

- **JSON Schema** (define o formato aceito),
- **Airtable/Firestore** (armazena e organiza instâncias de dado), e
- **Presigned URLs / API keys com escopo** (compartilhamento controlado, sem exigir login de
  quem recebe o link).

O caso de uso típico: você define o "formato de uma ficha de personagem" uma vez, cria uma pasta
por campanha, e cada jogador recebe um token `write` pro próprio documento — sem nunca ter acesso
de fato à conta.

### Princípios do MVP

- Schema é **imutável** depois de criado. Uma "nova versão" é um schema novo e independente.
- Documento é sempre substituído **por inteiro** (`PUT`). Sem edição parcial (`PATCH`) no MVP.
- Permissões são **hierárquicas e cumulativas** — não é uma lista de flags soltas.
- URLs são **RPC-ish**: o recurso aparece na rota, mas quando a intenção não é óbvia via verbo
  HTTP puro (ex: "só quero saber se mudou"), ela vira um sufixo explícito (`/status`).
- Segurança por obscuridade controlada: `404` é usado deliberadamente para não vazar informação
  sobre credenciais, mas **não** para esconder a existência de documentos (o nível mínimo de
  acesso, `list`, já expõe isso de propósito).

---

## 2. Entidades e modelo de dados

```
accounts(id, email, password_hash, created_at)

schemas(id, owner_id FK, name, json_schema jsonb, created_at)

folders(id, owner_id FK, schema_id FK, name, created_at)

documents(id UUID PK, folder_id FK, code VARCHAR, content jsonb,
          version int, content_hash, created_at, updated_at)
  UNIQUE(folder_id, code)

access_tokens(id, owner_type enum('folder','document'), owner_id,
              token_hash, password_hash nullable,
              permission_level enum(...),   -- validado conforme owner_type
              expires_at nullable, created_at)
```

**Por que `id` interno + `code` por pasta?** `id` (UUID) é usado internamente (FKs, logs,
tokens de documento). `code` é o identificador amigável, único **dentro da pasta**, usado nas
URLs públicas. Isso permite códigos legíveis (`ficha-joao`, `sessao-05`) sem colisão global.

### Hierarquia de permissões

**Token de pasta** (cada nível inclui os anteriores):

| Nível    | Pode                                                     |
|----------|----------------------------------------------------------|
| `list`   | Listar documentos da pasta + status (sem conteúdo)       |
| `read`   | tudo de `list` + ler conteúdo de qualquer documento      |
| `write`  | tudo de `read` + substituir documentos **já existentes** |
| `create` | tudo de `write` + criar documentos novos                 |
| `delete` | tudo de `create` + deletar documentos                    |

**Token de documento**:

| Nível   | Pode                                   |
|---------|----------------------------------------|
| `read`  | Ler o conteúdo                         |
| `write` | tudo de `read` + substituir o conteúdo |

Como é cumulativo, a checagem de autorização é uma simples comparação numérica:

```ts
const FOLDER_LEVELS = ['list', 'read', 'write', 'create', 'delete'] as const;
const DOCUMENT_LEVELS = ['read', 'write'] as const;

function hasPermission(
    tokenLevel: string,
    requiredLevel: string,
    levels: readonly string[]
): boolean {
    return levels.indexOf(tokenLevel) >= levels.indexOf(requiredLevel);
}

// exemplo: token tem 'write', rota exige 'read' -> true
hasPermission('write', 'read', FOLDER_LEVELS); // true
```

---

## 3. Validação com JSON Schema (ajv)

O schema definido pelo usuário é um JSON Schema padrão — tipos aninhados (`object`) já são
suportados nativamente pela especificação, sem precisar de lógica recursiva própria.

```ts
import Ajv, {ValidateFunction} from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({allErrors: true});
addFormats(ajv); // habilita "format": "date-time", etc.

// Cache de validadores compilados — schema é imutável, então a chave nunca precisa invalidar
const validatorCache = new Map<string, ValidateFunction>();

function getValidator(schemaId: string, jsonSchema: object): ValidateFunction {
    let validator = validatorCache.get(schemaId);
    if (!validator) {
        validator = ajv.compile(jsonSchema);
        validatorCache.set(schemaId, validator);
    }
    return validator;
}

function validateDocument(schemaId: string, jsonSchema: object, content: unknown) {
    const validate = getValidator(schemaId, jsonSchema);
    const valid = validate(content);
    if (!valid) {
        throw new ValidationError(validate.errors); // -> 422 na rota
    }
}
```

Exemplo de schema com atributo aninhado (o "outro JSON seguindo a mesma estrutura" que você
descreveu no início vira, em JSON Schema puro, apenas mais um `"type": "object"` com suas
próprias `properties`):

```json
{
  "type": "object",
  "properties": {
    "nome": {
      "type": "string"
    },
    "idade": {
      "type": "number"
    },
    "ativo": {
      "type": "boolean"
    },
    "criado_em": {
      "type": "string",
      "format": "date-time"
    },
    "endereco": {
      "type": "object",
      "properties": {
        "rua": {
          "type": "string"
        },
        "numero": {
          "type": "number"
        }
      },
      "required": [
        "rua"
      ]
    }
  },
  "required": [
    "nome"
  ],
  "additionalProperties": false
}
```

---

## 4. Cache do GET de documento

O cache existe **só para leitura de documento** (não para schema — schema já é barato de buscar
e muda raramente de contexto). A prioridade é servir `GET` e `/status` o mais rápido possível.

Guardar como **hash no Redis** (não um blob JSON serializado) permite que `/status` peça só os
campos que precisa, sem puxar `content` inteiro:

```ts
import {createClient} from 'redis';

const redis = createClient();

function cacheKey(folderId: string, code: string) {
    return `doc:${folderId}:${code}`;
}

async function cacheDocument(folderId: string, code: string, doc: {
    content: object; version: number; contentHash: string; updatedAt: string;
}) {
    await redis.hSet(cacheKey(folderId, code), {
        content: JSON.stringify(doc.content),
        version: String(doc.version),
        content_hash: doc.contentHash,
        updated_at: doc.updatedAt,
    });
    await redis.expire(cacheKey(folderId, code), 3600); // TTL de segurança, não é o mecanismo principal
}

async function getDocumentFromCache(folderId: string, code: string) {
    const data = await redis.hGetAll(cacheKey(folderId, code));
    if (!data.content) return null; // cache miss
    return {
        content: JSON.parse(data.content),
        version: Number(data.version),
        contentHash: data.content_hash,
        updatedAt: data.updated_at,
    };
}

// /status só pede os campos leves, sem tocar em `content`
async function getDocumentStatusFromCache(folderId: string, code: string) {
    const data = await redis.hmGet(
        cacheKey(folderId, code),
        ['version', 'content_hash', 'updated_at']
    );
    if (!data[1]) return null; // content_hash ausente = cache miss
    return {version: Number(data[0]), contentHash: data[1], updatedAt: data[2]};
}
```

**Invalidação no `PUT`**: escreve o valor novo direto no cache (não faz `DEL`), evitando efeito
manada em documentos populares logo após uma edição:

```ts
async function putDocument(folderId: string, code: string, content: object) {
    const existing = await db.documents.findByFolderAndCode(folderId, code);

    const contentHash = sha256(JSON.stringify(content));
    const version = existing ? existing.version + 1 : 1;
    const now = new Date().toISOString();

    const doc = await db.documents.upsert({
        folderId, code, content, version, contentHash, updatedAt: now,
    });

    // popula o cache já com o dado novo (evita miss logo em seguida)
    await cacheDocument(folderId, code, {
        content, version, contentHash: contentHash, updatedAt: now,
    });

    return doc;
}
```

### Rota de leitura, com suporte a `ETag`

```ts
app.get('/folders/:folderId/documents/:code', authMiddleware, async (req, res) => {
    const {folderId, code} = req.params;

    let doc = await getDocumentFromCache(folderId, code);
    if (!doc) {
        doc = await db.documents.findByFolderAndCode(folderId, code);
        if (!doc) return res.status(404).end();
        await cacheDocument(folderId, code, doc);
    }

    if (req.headers['if-none-match'] === doc.contentHash) {
        return res.status(304).end();
    }

    res.setHeader('ETag', doc.contentHash);
    res.json({code, content: doc.content, version: doc.version, updated_at: doc.updatedAt});
});
```

### Rota `/status` — feita para polling barato

```ts
app.get('/folders/:folderId/documents/:code/status', authMiddleware, async (req, res) => {
    const {folderId, code} = req.params;

    let status = await getDocumentStatusFromCache(folderId, code);
    if (!status) {
        const doc = await db.documents.findByFolderAndCode(folderId, code);
        if (!doc) return res.status(404).end();
        status = {version: doc.version, contentHash: doc.contentHash, updatedAt: doc.updatedAt};
        await cacheDocument(folderId, code, {content: doc.content, ...status});
    }

    if (req.headers['if-none-match'] === status.contentHash) {
        return res.status(304).end();
    }

    res.setHeader('ETag', status.contentHash);
    res.json({code, version: status.version, content_hash: status.contentHash, updated_at: status.updatedAt});
});
```

---

## 5. Rate limiting

Duas categorias, com chaves e limites diferentes. Sliding window no Redis:

```ts
async function checkRateLimit(key: string, limit: number, windowSeconds: number) {
    const now = Date.now();
    const windowKey = `ratelimit:${key}:${Math.floor(now / (windowSeconds * 1000))}`;

    const count = await redis.incr(windowKey);
    if (count === 1) {
        await redis.expire(windowKey, windowSeconds);
    }

    return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
    };
}

// Exemplo de uso em middleware
async function rateLimitMiddleware(category: 'write' | 'read' | 'status') {
    const LIMITS = {
        write: {limit: 20, window: 60},  // apertado
        read: {limit: 100, window: 60},  // médio
        status: {limit: 300, window: 60},  // permissivo — feito pra polling
    };

    return async (req, res, next) => {
        const identity = req.token?.id ?? req.account?.id;
        const {limit, window} = LIMITS[category];
        const result = await checkRateLimit(`${identity}:${category}`, limit, window);

        res.setHeader('X-RateLimit-Remaining', String(result.remaining));
        if (!result.allowed) {
            res.setHeader('Retry-After', String(window));
            return res.status(429).json({error: 'rate_limit_exceeded'});
        }
        next();
    };
}
```

---

## 6. Autenticação — dois esquemas convivendo

- **Dono da conta**: JWT (`Authorization: Bearer <jwt>`), acesso total às próprias entidades.
- **Convidado com token**: Basic Auth, token como usuário e senha (se configurada) como senha
  (`Authorization: Basic base64(token:senha)`).

```ts
import {timingSafeEqual} from 'crypto';
import bcrypt from 'bcrypt';

async function authenticateToken(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Basic ')) return res.status(401).end();

    const [token, password] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    const tokenHash = sha256(token);

    const record = await db.accessTokens.findByHash(tokenHash);

    // 1. Token não existe -> 401
    if (!record) return res.status(401).json({error: 'invalid_token'});

    // 2. Token expirado -> 401
    if (record.expiresAt && record.expiresAt < new Date()) {
        return res.status(401).json({error: 'token_expired'});
    }

    // 3. Senha exigida e incorreta -> 404 (não revela que o token existe)
    if (record.passwordHash) {
        const passwordOk = await bcrypt.compare(password ?? '', record.passwordHash);
        if (!passwordOk) return res.status(404).end();
    }

    req.token = record; // segue pro próximo middleware (verificação de recurso + permissão)
    next();
}
```

> `bcrypt.compare` já opera em tempo constante — evita timing attack para diferenciar "token
> inexistente" de "token existe, senha errada" por latência.

Ordem de verificação completa (reforçando o que foi decidido):

```
1. Token existe no banco (hash bate)?           não -> 401
2. Token expirou?                                sim -> 401
3. Requer senha e senha bate?                    não -> 404
4. Recurso (pasta/doc) existe?                   não -> 404
5. Nível de permissão do token cobre a rota?     não -> 403
6. -> segue o processamento normal
```

---

## 7. Endpoints (RPC-ish)

🔑 = JWT (dono) · 🎫 = Basic Auth (token de acesso)

### Conta

```
POST   /accounts/register                🔑❌   { email, password }
POST   /accounts/login                   🔑❌   { email, password } -> { jwt }
GET    /accounts/me                      🔑
```

### Schemas (imutáveis)

```
POST   /schemas                          🔑      { name, json_schema }
GET    /schemas                          🔑
GET    /schemas/:schemaId                🔑
DELETE /schemas/:schemaId                🔑      só se nenhuma folder usar
```

### Folders

```
POST   /folders                          🔑      { name, schema_id }
GET    /folders                          🔑
GET    /folders/:folderId                🔑
DELETE /folders/:folderId                🔑
```

### Documentos

```
PUT    /folders/:folderId/documents/:code           🔑 ou 🎫(write+)
       cria se não existe (exige create), substitui se existe (write)
       body: { content: {...} }

GET    /folders/:folderId/documents/:code           🔑 ou 🎫(read+)
       conteúdo completo — suporta ETag / If-None-Match

GET    /folders/:folderId/documents/:code/status     🔑 ou 🎫(list+)
       só metadados — feito para polling barato

GET    /folders/:folderId/documents                  🔑 ou 🎫(list+)
       lista { code, version, content_hash, updated_at }[] — nunca content

DELETE /folders/:folderId/documents/:code            🔑 ou 🎫(delete)
```

### Tokens de acesso

```
POST   /folders/:folderId/tokens          🔑      { permission_level, password?, expires_at? }
POST   /documents/:documentId/tokens      🔑      { permission_level, password?, expires_at? }
GET    /folders/:folderId/tokens          🔑      lista tokens ativos
DELETE /tokens/:tokenId                   🔑      revoga (funciona pros dois tipos)
```

> O token em texto puro só aparece na resposta do `POST /tokens` — nunca mais depois disso.
> Só o hash fica persistido.

---

## 8. Códigos de resposta — referência rápida

| Código | Quando                                                      |
|--------|-------------------------------------------------------------|
| `200`  | Sucesso em leitura/atualização                              |
| `201`  | Documento/schema/pasta/token criado                         |
| `304`  | `If-None-Match` bate com o `content_hash` atual             |
| `401`  | Token não existe ou expirou                                 |
| `403`  | Token válido, senha ok, mas nível de permissão insuficiente |
| `404`  | Recurso não existe **ou** senha do token incorreta          |
| `422`  | Conteúdo não bate com o JSON Schema (erros do ajv)          |
| `429`  | Rate limit estourado (com header `Retry-After`)             |

---

## 9. O que fica para depois (fora do MVP)

- Versionamento/merge de schema (hoje: nova versão = schema novo e independente)
- Edição parcial de documento (`PATCH`)
- Auditoria de alterações (quem mudou o quê, especialmente via token anônimo)
- Escopo de token por origem (IP, domínio)
- Times/organizações multi-usuário
