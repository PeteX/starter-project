# starter-project

This is a simple web project with lit-element, a service worker, OIDC authentication and a .NET 5 server for the API.

**While everyone is welcome to use it, it's mainly here to help people who work with me directly.**

## Client

The client uses web components.  Essentially, browser vendors looked at component-based libraries such as React and Angular, and realised that there were benefits if they built a lot of the technology into the browser.  For many years adoption was held up because of poor support by Microsoft Edge, but Edge now fully supports web components, so there is no reason not to use them unless support for legacy browsers is required.  This project also uses lit-element, a Google-backed project which adds some utility functions to the basic web component API.

Web components look like normal HTML elements, except that the names are always two words: `<my-element>` not `<myelement>`.  This project achieves this by starting all component names with `app`.

Like Angular components, web components are fully isolated from the rest of the DOM tree.  Because the technology is built into the browser, the rough edges that can arise in Angular are generally absent.  This does mean that each web component is styled completely separately.

In this project, the components and other source files are in the `/src/` directory.  There is a sample web component in `rpc.ts` and its styles are in `rpc.scss`.  Notice how `rpc.scss` includes `global.scss` to allow the application to have global styles as well.

Web components are Javascript classes.  Within the object, you have access to the main DOM tree through `this.querySelector` and the isolated ("shadow") DOM tree through `this.shadowRoot.querySelector`.  There is no equivalent of React's refs.  If you want direct access to the elements in your component, you just use standard DOM APIs.

Unlike React and Angular, you request DOM updates explicitly, using `this.requestUpdate`.  It is only automatic if the component's properties have changed.

Documentation for `lit-element` is [here](https://lit-element.polymer-project.org/).  You will notice obvious similarities with React and Angular, but the technology used is built into the browser rather than being retrofitted.

You may also find it helpful to install [this extension](https://marketplace.visualstudio.com/items?itemName=runem.lit-plugin) for Visual Studio Code.  It will apply HTML highlighting and code completion to the ``html` `` HTML strings.

### Running the Client

You have three options for running the client:

* `npm start` will run the application in watch mode, reloading if there is a change to the source files.

* `npm run build-dev` will build a development version of the application under `/dist`.

* `npm run build-release` will build a release version of the application under `/dist`.

The first option has the service worker disabled, for two reasons.  First of all, it adds extra complexity during development because bugs can cause outdated files to be used.  Secondly, there is a bug in Workbox which causes it to misbehave when Webpack is not restarted completely between builds.

When hosting the client, the CDN should cache all files in its edge nodes, but it should send `must-revalidate` to the browsers.  The reason is that the service worker takes care of caching, so setting it in the cache headers as well only adds complexity.

The service worker always revalidates `index.html` so when the site is changed, new visitors will get the updated version immediately.  They will not have to wait for the service worker to update in the background.

## Server

First [install .NET 5](https://dotnet.microsoft.com/download).  This application is tested on Linux, so while .NET was historically associated with Windows, you may (or may not) get issues if you attempt to use it in this case.

When you have .NET installed, change into the `/server` directory and type `dotnet run` or `dotnet watch run`.  As you would expect, `dotnet watch run` reloads the server if the C# source files are changed.

When running in development mode, the server provides an endpoint for downloading Swagger files and interacting with the API.  It can be found at http://localhost:5002/swagger/index.html.

## Integrating Client and Server

The server includes a sample API which returns a made-up weather forecast; this is one of the .NET starter applications.  It has been changed, though, to require authentication.

When you run the client and the server together, and visit the client in your browser, you will normally start by getting an `Unauthorised` message.  When you sign in, you will be taken to the configured OIDC server.  If you don't change anything, it will be `accounts.tomatwo.com`, which is operated by me.  Feel free to create an account if that is helpful.

It has been tested with Keycloak and should work with Cognito and the various Azure login options.
