import {ApiContext, HttpMethod, ApiAdaptor} from "valory-runtime";
import {IncomingMessage, ServerResponse} from "http";

const polka = require("polka");
const pathReplacer = /{([\S]*?)}/g;

export class PolkaAdaptor implements ApiAdaptor {
    private server = polka();
    private port = 8080;
    private host?: string;

    constructor(port?: number, host?: string) {
        this.port = +process.env.PORT || port;
        this.host = process.env.HOST || host;
    }

    public register(path: string, method: HttpMethod, handler: (ctx: ApiContext) => Promise<ApiContext>) {
        const formattedPath = path.replace(pathReplacer, ":$1");
        this.server.add(method, formattedPath, (req: IncomingMessage, res: ServerResponse) => {
            let rawBody: string = "";

            req.on("data", (chunk: Buffer) => {
                rawBody += chunk.toString();
            });

            req.on("end", async () => {
                const ctx = new ApiContext({
                    headers: req.headers,
                    pathParams: (req as any).params,
                    path,
                    method,
                    rawBody,
                    query: (req as any)._parsedUrl.query
                });

                await handler(ctx);
                res.writeHead(ctx.response.statusCode, ctx.prepareHeaders());
                res.end(ctx.serializeResponse());
            });
        });
    }

    public start() {
        this.server.listen(this.port, this.host)
    }

    public shutdown() {
        this.server.close()
    }
}
