import { getAccessToken } from "./oidc";

let requestsOutstanding = 0;
let listener: (outstanding: number) => void = null;

type UrlEncode = { [key: string]: string | number | boolean };

export interface RequestProps {
  body?: BodyInit;
  form?: UrlEncode;
  query?: UrlEncode;
}

export async function request(url: string, props?: RequestProps) {
  requestsOutstanding++;
  listener && listener(requestsOutstanding);

  try {
    let token = await getAccessToken();
    let serverAddress = 'https://my-api.example.com/';

    // Note, webpack will remove the following lines in production builds.
    if(process.env.NODE_ENV === 'development')
      serverAddress = 'http://localhost:5002';

    serverAddress = localStorage.getItem('app.server') || serverAddress;

    let queryStr = '';
    if(props?.query) {
      let searchParams = new URLSearchParams();
      Object.entries(props.query).forEach(([key, value]) => searchParams.append(key, value.toString()));
      queryStr = '?' + searchParams.toString();
    }

    let body: URLSearchParams = null;
    if(props?.form) {
      body = new URLSearchParams();
      Object.entries(props.form).forEach(([key, value]) => body.append(key, value.toString()));
    }

    let finalUrl = `${serverAddress}${url}${queryStr}`;

    let req = await fetch(finalUrl, {
      method: props?.form || props?.body ? 'POST' : 'GET',
      body: props?.body ? props.body : body,
      headers: {
        ... props?.form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
        ... token ? { Authorization: `bearer ${token}` } : {}
      }
    });

    if(req.status >= 400)
      throw { status: req.status, statusText: req.statusText };

    return await req.json();
  } finally {
    requestsOutstanding--;
    listener && listener(requestsOutstanding);
  }
}

export function registerListener(listenerArg: (outstanding: number) => void) {
  listener = listenerArg;
}
