import { NextRequest, NextResponse } from "next/server";
import { ActionClient, ActionClientError } from "./dist/index";
import { z } from "zod";

type User = {
  id: string;
};

type ActionContextType = { user?: User };

const client = ({ req }: { req: NextRequest }) => {
  return new ActionClient<ActionContextType>({
    req,
    ctx: { user: undefined },
  });
};

const authenticatedClient = ({ req }: { req: NextRequest }) => {
  return new ActionClient<Required<ActionContextType>>({
    req,
  }).use(async () => {
    const user = JSON.parse(req.cookies.get("AUTH")?.value ?? "{}") as
      | {
        id: string;
      }
      | undefined;
    if (!user?.id) {
      throw new ActionClientError("Failed to parse", 401);
    }
    return { ctx: { user } };
  });
};

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
