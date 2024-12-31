import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodType as ZodSchema, ZodVoid } from "zod";

// https://github.com/colinhacks/zod/discussions/2134#discussioncomment-5194111
const zodKeys = <T extends z.ZodTypeAny>(schema: T): string[] => {
  try {
    // make sure schema is not null or undefined
    if (schema === null || schema === undefined) return [];
    // check if schema is nullable or optional
    if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional)
      return zodKeys(schema.unwrap());
    // check if schema is an array
    if (schema instanceof z.ZodArray) return zodKeys(schema.element);
    // check if schema is an object
    if (schema instanceof z.ZodObject) {
      // get key/value pairs from schema
      const entries = Object.entries(schema.shape);
      // loop through key/value pairs
      return entries.flatMap(([key, value]) => {
        // get nested keys
        const nested =
          value instanceof z.ZodType
            ? zodKeys(value).map((subKey) => `${key}.${subKey}`)
            : [];
        // return nested keys
        return nested.length ? nested : key;
      });
    }
    // return empty array
    return [];
  } catch {
    return ["Invalid keys in zod schema"];
  }
};

export class ActionClientError extends Error {
  statusCode = 500;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ServerError";
    this.statusCode = statusCode;
  }
}
type MiddlewareFnType<T> = ({
  ctx,
  req,
}: {
  ctx: T;
  req: NextRequest;
}) => Promise<{ ctx: T }>;

export class ActionClient<
  TCtx extends object,
  TParsedQuerySchema extends ZodSchema = ZodVoid,
  TParsedInputSchema extends ZodSchema = ZodVoid
> {
  readonly #req: NextRequest;
  readonly #querySchemaFn: ZodSchema = z.void();
  readonly #method: "GET" | "POST" | "" = "";
  #ctx: TCtx | undefined;
  readonly #inputSchemaFn: ZodSchema | null = null;
  readonly #err: ActionClientError | null = null;

  #state: { type: string; data?: unknown }[] = [];

  #traceId: string | undefined;

  readonly #middlewareFns: MiddlewareFnType<TCtx>[] = [];

  constructor({
    req,
    querySchemaFn,
    inputSchemaFn,
    method,
    ctx,
    err,
    middlewareFns,
    internalState,
  }: {
    req: NextRequest;
    querySchemaFn?: TParsedQuerySchema;
    inputSchemaFn?: TParsedInputSchema | null;
    method?: "GET" | "POST" | "";
    ctx?: TCtx;
    err?: ActionClientError | null;
    middlewareFns?: MiddlewareFnType<TCtx>[];
    internalState?: {
      traceId: string;
      state: { type: string; data?: unknown }[];
    };
  }) {
    this.#req = req;

    if (method) this.#method = method;

    if (querySchemaFn) this.#querySchemaFn = querySchemaFn;
    if (inputSchemaFn) this.#inputSchemaFn = inputSchemaFn;

    if (ctx) {
      this.#ctx = { ...ctx };
    }

    if (err) {
      this.#err = err;
    }
    if (middlewareFns && middlewareFns?.length > 0) {
      this.#middlewareFns = middlewareFns;
    }
    if (internalState) {
      this.#state = internalState.state;
      this.#traceId = internalState.traceId;
    } else {
      this.#state = [];
      this.#traceId = randomUUID();
    }
  }

  use(middlewareFn: MiddlewareFnType<TCtx>) {
    this.#state.push({ type: "use", data: middlewareFn.name });
    const middlewareFns = this.#middlewareFns ?? [];
    middlewareFns.push(middlewareFn);
    return new ActionClient({
      req: this.#req,
      querySchemaFn: this.#querySchemaFn,
      method: this.#method,
      inputSchemaFn: this.#inputSchemaFn,
      err: this.#err,
      ctx: this.#ctx,
      middlewareFns,
      internalState: {
        state: this.#state,
        traceId: this.#traceId ?? randomUUID(),
      },
    }) as ActionClient<TCtx, TParsedInputSchema, TParsedInputSchema>;
  }

  query<TSchema extends ZodSchema>(schemaFn: TSchema) {
    this.#state.push({ type: "query", data: zodKeys(schemaFn) });
    return new ActionClient({
      req: this.#req,
      querySchemaFn: schemaFn,
      method: this.#method,
      inputSchemaFn: this.#inputSchemaFn,
      err: this.#err,
      ctx: this.#ctx,
      middlewareFns: this.#middlewareFns,
      internalState: {
        state: this.#state,
        traceId: this.#traceId ?? randomUUID(),
      },
    }) as ActionClient<TCtx, z.infer<TSchema>, TParsedInputSchema>;
  }

  json<TSchema extends ZodSchema>(schemaFn: TSchema) {
    this.#state.push({ type: "json", data: zodKeys(schemaFn) });

    let err: ActionClientError | null = null;
    if (this.#inputSchemaFn) {
      err = new ActionClientError(
        "Cannot chain parsing data of types like .json().json() or .json().formData()",
        401
      );
    }
    return new ActionClient({
      req: this.#req,
      querySchemaFn: this.#querySchemaFn,
      method: this.#method,
      inputSchemaFn: schemaFn,
      err: err,
      ctx: this.#ctx,
      middlewareFns: this.#middlewareFns,
      internalState: {
        state: this.#state,
        traceId: this.#traceId ?? randomUUID(),
      },
    }) as ActionClient<TCtx, TParsedQuerySchema, z.infer<TSchema>>;
  }

  async action(
    actionFn: ({
      parsedQuery,
      ctx,
    }: {
      parsedQuery: TParsedQuerySchema;
      parsedInput: TParsedInputSchema;
      ctx: TCtx;
    }) => NextResponse | Promise<NextResponse>
  ) {
    this.#state.push({ type: "action" });

    try {
      if (this.#err) {
        console.log(this.#err);
        throw this.#err;
      }
      let parsedQuery: unknown = undefined;
      if (!this.#method) {
        throw new ActionClientError("No method defined", 400);
      }

      if (this.#middlewareFns?.length > 0 && this.#ctx) {
        for (const fn of this.#middlewareFns) {
          const { ctx } = await fn({ ctx: this.#ctx, req: this.#req });
          this.#ctx = ctx;
        }
      }

      if (this.#querySchemaFn) {
        const searchParams = this.#req.nextUrl.searchParams;
        const { success, data, error } = this.#querySchemaFn.safeParse(
          Object.fromEntries(searchParams)
        );
        if (!success) {
          throw new ActionClientError(
            `Failed to parse query. ${error.issues[0].message}`,
            400
          );
        }
        parsedQuery = data;
      }

      let parsedInput: unknown = undefined;
      if (this.#method === "POST") {
        let parsedBody;
        try {
          parsedBody = await this.#req.json();
        } catch (err) {
          console.error(
            `Parsing failed of json request. Check headers and body sent`,
            err
          );
          throw new ActionClientError("Parsing failed of req.body", 400);
        }
        if (this.#inputSchemaFn) {
          const { success, data, error } =
            this.#inputSchemaFn.safeParse(parsedBody);
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
        parsedQuery: parsedQuery as TParsedQuerySchema,
        parsedInput: parsedInput as TParsedInputSchema,
        ctx: this.#ctx as TCtx,
      });
    } catch (err) {
      if (err instanceof ActionClientError) {
        console.error(
          JSON.stringify({
            traceId: this.#traceId,
            errorType: `[known error]`,
            message: err.message,
            name: err.name,
            statusCode: err.statusCode,
            state: this.#state,
          })
        );

        return NextResponse.json(
          {
            message: err.message,
          },
          {
            status: err.statusCode,
          }
        );
      }
      console.error(
        JSON.stringify({
          traceId: this.#traceId,
          errorType: `[unknown error]`,
          stack: err,
          state: this.#state,
        })
      );
      return NextResponse.json(
        {
          message: "Internal Server Error",
        },
        {
          status: 500,
        }
      );
    }
  }

  method(_method: "GET" | "POST") {
    return new ActionClient({
      req: this.#req,
      querySchemaFn: this.#querySchemaFn,
      method: _method,
      inputSchemaFn: this.#inputSchemaFn,
      err: this.#err,
      ctx: this.#ctx,
      middlewareFns: this.#middlewareFns,
      internalState: {
        state: this.#state,
        traceId: this.#traceId ?? randomUUID(),
      },
    });
  }
}
