var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ActionClient: () => ActionClient,
  ActionClientError: () => ActionClientError
});
module.exports = __toCommonJS(index_exports);
var import_server = require("next/server");
var import_zod = require("zod");
var ActionClientError = class extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = 500;
    this.name = "ServerError";
    this.statusCode = statusCode;
  }
};
var _req, _querySchemaFn, _method, _ctx, _inputSchemaFn, _err, _middlewareFns;
var _ActionClient = class _ActionClient {
  constructor({
    req,
    querySchemaFn,
    inputSchemaFn,
    method,
    ctx,
    err,
    middlewareFns
  }) {
    __privateAdd(this, _req);
    __privateAdd(this, _querySchemaFn, import_zod.z.void());
    __privateAdd(this, _method, "");
    __privateAdd(this, _ctx);
    __privateAdd(this, _inputSchemaFn, null);
    __privateAdd(this, _err, null);
    __privateAdd(this, _middlewareFns, []);
    __privateSet(this, _req, req);
    if (method) __privateSet(this, _method, method);
    if (querySchemaFn) __privateSet(this, _querySchemaFn, querySchemaFn);
    if (inputSchemaFn) __privateSet(this, _inputSchemaFn, inputSchemaFn);
    if (ctx) {
      __privateSet(this, _ctx, { ...ctx });
    }
    if (err) {
      __privateSet(this, _err, err);
    }
    if (middlewareFns && (middlewareFns == null ? void 0 : middlewareFns.length) > 0) {
      __privateSet(this, _middlewareFns, middlewareFns);
    }
  }
  use(middlewareFn) {
    var _a;
    const middlewareFns = (_a = __privateGet(this, _middlewareFns)) != null ? _a : [];
    middlewareFns.push(middlewareFn);
    return new _ActionClient({
      req: __privateGet(this, _req),
      querySchemaFn: __privateGet(this, _querySchemaFn),
      method: __privateGet(this, _method),
      inputSchemaFn: __privateGet(this, _inputSchemaFn),
      err: __privateGet(this, _err),
      ctx: __privateGet(this, _ctx),
      middlewareFns
    });
  }
  query(schemaFn) {
    return new _ActionClient({
      req: __privateGet(this, _req),
      querySchemaFn: schemaFn,
      method: __privateGet(this, _method),
      inputSchemaFn: __privateGet(this, _inputSchemaFn),
      err: __privateGet(this, _err),
      ctx: __privateGet(this, _ctx),
      middlewareFns: __privateGet(this, _middlewareFns)
    });
  }
  json(schemaFn) {
    let err = null;
    if (__privateGet(this, _inputSchemaFn)) {
      err = new ActionClientError(
        "Cannot chain parsing data of types like .json().json() or .json().formData()",
        401
      );
    }
    return new _ActionClient({
      req: __privateGet(this, _req),
      querySchemaFn: __privateGet(this, _querySchemaFn),
      method: __privateGet(this, _method),
      inputSchemaFn: schemaFn,
      err,
      ctx: __privateGet(this, _ctx),
      middlewareFns: __privateGet(this, _middlewareFns)
    });
  }
  async action(actionFn) {
    var _a;
    try {
      if (__privateGet(this, _err)) {
        console.log(__privateGet(this, _err));
        throw __privateGet(this, _err);
      }
      let parsedQuery = void 0;
      if (!__privateGet(this, _method)) {
        throw new ActionClientError("No method defined", 400);
      }
      if (((_a = __privateGet(this, _middlewareFns)) == null ? void 0 : _a.length) > 0 && __privateGet(this, _ctx)) {
        for (const fn of __privateGet(this, _middlewareFns)) {
          const { ctx } = await fn({ ctx: __privateGet(this, _ctx), req: __privateGet(this, _req) });
          __privateSet(this, _ctx, ctx);
        }
      }
      if (__privateGet(this, _querySchemaFn)) {
        const { success, data, error } = __privateGet(this, _querySchemaFn).safeParse(
          Object.fromEntries(__privateGet(this, _req).nextUrl.searchParams)
        );
        if (!success) {
          throw new ActionClientError(
            `Failed to parse query. ${error.issues[0].message}`,
            400
          );
        }
        parsedQuery = data;
      }
      let parsedInput = void 0;
      if (__privateGet(this, _method) === "POST") {
        let parsedBody;
        try {
          parsedBody = await __privateGet(this, _req).json();
        } catch (err) {
          console.error(
            `Parsing failed of json request. Check headers and body sent`,
            err
          );
          throw new ActionClientError("Parsing failed of req.body", 400);
        }
        if (__privateGet(this, _inputSchemaFn)) {
          const { success, data, error } = __privateGet(this, _inputSchemaFn).safeParse(parsedBody);
          if (!success) {
            throw new ActionClientError(
              `Failed to parse body. ${error.issues[0].message}`,
              400
            );
          }
          parsedInput = data;
        }
      }
      return actionFn({
        parsedQuery,
        parsedInput,
        ctx: __privateGet(this, _ctx)
      });
    } catch (err) {
      if (err instanceof ActionClientError) {
        console.error(`[known error]`, err.message, err.name, err.statusCode);
        return import_server.NextResponse.json(
          {
            message: err.message
          },
          {
            status: err.statusCode
          }
        );
      }
      console.error(err);
      return import_server.NextResponse.json(
        {
          message: "Internal Server Error"
        },
        {
          status: 500
        }
      );
    }
  }
  method(_method2) {
    return new _ActionClient({
      req: __privateGet(this, _req),
      querySchemaFn: __privateGet(this, _querySchemaFn),
      method: _method2,
      inputSchemaFn: __privateGet(this, _inputSchemaFn),
      err: __privateGet(this, _err),
      ctx: __privateGet(this, _ctx),
      middlewareFns: __privateGet(this, _middlewareFns)
    });
  }
};
_req = new WeakMap();
_querySchemaFn = new WeakMap();
_method = new WeakMap();
_ctx = new WeakMap();
_inputSchemaFn = new WeakMap();
_err = new WeakMap();
_middlewareFns = new WeakMap();
var ActionClient = _ActionClient;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ActionClient,
  ActionClientError
});
//# sourceMappingURL=index.js.map