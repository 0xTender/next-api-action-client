## Replace complex routes with client.

Inspired by [next-safe-action]("https://next-safe-action.dev/")

View [playground.ts]("./playground.ts")

```ts
export const GET = (req: NextRequest) =>
  client({ req })
    .method("GET")
    .query(
      z.object({
        page: z.coerce.number().default(0),
        pageSize: z.coerce.number().default(25),
      }),
    )
    .action(({ ctx, parsedQuery }) => {
      console.log(ctx.user, parsedQuery);
      return NextResponse.json({ success: true });
    });

export const POST = (req: NextRequest) =>
  authenticatedClient({ req })
    .method("POST")
    .json(
      z.object({
        title: z.string(),
      }),
    )
    .action(({ ctx, parsedQuery, parsedInput }) => {
      console.log(ctx, parsedQuery, parsedInput);
      return NextResponse.json({ success: true });
    });
```

