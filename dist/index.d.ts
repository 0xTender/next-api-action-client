import { NextRequest, NextResponse } from 'next/server';
import { ZodType, ZodVoid, z } from 'zod';

declare class ActionClientError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number);
}
type MiddlewareFnType<T> = ({ ctx, req, }: {
    ctx: T;
    req: NextRequest;
}) => Promise<{
    ctx: T;
}>;
declare class ActionClient<TCtx extends object, TParsedQuerySchema extends ZodType = ZodVoid, TParsedInputSchema extends ZodType = ZodVoid> {
    #private;
    constructor({ req, querySchemaFn, inputSchemaFn, method, ctx, err, middlewareFns, }: {
        req: NextRequest;
        querySchemaFn?: TParsedQuerySchema;
        inputSchemaFn?: TParsedInputSchema | null;
        method?: "GET" | "POST" | "";
        ctx?: TCtx;
        err?: ActionClientError | null;
        middlewareFns?: MiddlewareFnType<TCtx>[];
    });
    use(middlewareFn: MiddlewareFnType<TCtx>): ActionClient<TCtx, TParsedInputSchema, TParsedInputSchema>;
    query<TSchema extends ZodType>(schemaFn: TSchema): ActionClient<TCtx, z.infer<TSchema>, TParsedInputSchema>;
    json<TSchema extends ZodType>(schemaFn: TSchema): ActionClient<TCtx, TParsedQuerySchema, z.infer<TSchema>>;
    action(actionFn: ({ parsedQuery, ctx, }: {
        parsedQuery: TParsedQuerySchema;
        parsedInput: TParsedInputSchema;
        ctx: TCtx;
    }) => NextResponse | Promise<NextResponse>): Promise<NextResponse<unknown>>;
    method(_method: "GET" | "POST"): ActionClient<TCtx, z.ZodType<any, z.ZodTypeDef, any>, z.ZodType<any, z.ZodTypeDef, any>>;
}

export { ActionClient, ActionClientError };
