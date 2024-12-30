import { NextRequest, NextResponse } from "next/server";
import { z, ZodType as ZodSchema, ZodVoid } from "zod";

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
  TParsedInputSchema extends ZodSchema = ZodVoid,
> {
  readonly #req: NextRequest;
  readonly #querySchemaFn: ZodSchema = z.void();
  readonly #method: "GET" | "POST" | "" = "";
  #ctx: TCtx | undefined;
  readonly #inputSchemaFn: ZodSchema | null = null;
  readonly #err: ActionClientError | null = null;

  readonly #middlewareFns: MiddlewareFnType<TCtx>[] = [];

  constructor({
    req,
    querySchemaFn,
    inputSchemaFn,
    method,
    ctx,
    err,
    middlewareFns,
  }: {
    req: NextRequest;
    querySchemaFn?: TParsedQuerySchema;
    inputSchemaFn?: TParsedInputSchema | null;
    method?: "GET" | "POST" | "";
    ctx?: TCtx;
    err?: ActionClientError | null;
    middlewareFns?: MiddlewareFnType<TCtx>[];
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
  }

  use(middlewareFn: MiddlewareFnType<TCtx>) {
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
    }) as ActionClient<TCtx, TParsedInputSchema, TParsedInputSchema>;
  }

  query<TSchema extends ZodSchema>(schemaFn: TSchema) {
    return new ActionClient({
      req: this.#req,
      querySchemaFn: schemaFn,
      method: this.#method,
      inputSchemaFn: this.#inputSchemaFn,
      err: this.#err,
      ctx: this.#ctx,
      middlewareFns: this.#middlewareFns,
    }) as ActionClient<TCtx, z.infer<TSchema>, TParsedInputSchema>;
  }

  json<TSchema extends ZodSchema>(schemaFn: TSchema) {
    let err: ActionClientError | null = null;
    if (this.#inputSchemaFn) {
      err = new ActionClientError(
        "Cannot chain parsing data of types like .json().json() or .json().formData()",
        401,
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
    }) => NextResponse | Promise<NextResponse>,
  ) {
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
        const { success, data, error } = this.#querySchemaFn.safeParse(
          Object.fromEntries(this.#req.nextUrl.searchParams as any),
        );
        if (!success) {
          throw new ActionClientError(
            `Failed to parse query. ${error.issues[0].message}`,
            400,
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
            err,
          );
          throw new ActionClientError("Parsing failed of req.body", 400);
        }
        if (this.#inputSchemaFn) {
          const { success, data, error } =
            this.#inputSchemaFn.safeParse(parsedBody);
          if (!success) {
            throw new ActionClientError(
              `Failed to parse body. ${error.issues[0].message}`,
              400,
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
        console.error(`[known error]`, err.message, err.name, err.statusCode);
        return NextResponse.json(
          {
            message: err.message,
          },
          {
            status: err.statusCode,
          },
        );
      }
      console.error(err);
      return NextResponse.json(
        {
          message: "Internal Server Error",
        },
        {
          status: 500,
        },
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
    });
  }
}
