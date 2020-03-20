import {ApiContext, HttpMethod, ApiAdaptor} from "valory-runtime";
import {IncomingMessage, ServerResponse} from "http";
import qs = require("querystring");
import url = require("url");

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
                const parsedUrl = url.parse(req.url, true);
                const body = attemptParse(req.headers["content-type"], rawBody);
                const ctx = new ApiContext({
                    headers: req.headers,
                    queryParams: parsedUrl.query,
                    pathParams: (req as any).params,
                    path,
                    method,
                    body,
                    formData: body as any,
                    rawBody,
                });

                await handler(ctx);
                res.writeHead(ctx.response.statusCode, ctx.response.headers);
                res.end(ctx.serializeResponse())
            })
        })
    }

    public start() {
        this.server.listen(this.port, this.host)
    }

    public shutdown() {
        this.server.close()
    }
}

function attemptParse(contentType: string, obj: any): any {
    if (contentType == null) {
        return obj;
    }
    const parsedContentType = contentType.split(";")[0];
    try {
        switch (parsedContentType) {
            case "application/json":
                return JSON.parse(obj);
            case "application/x-www-form-urlencoded":
                return qs.parse(obj);
            default:
                return obj;
        }
    } catch (err) {
        return obj;
    }
}
