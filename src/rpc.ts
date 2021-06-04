import { html, unsafeCSS, LitElement, PropertyValues } from 'lit';
import { customElement } from 'lit/decorators.js';
import { request } from './comms';
import styles from './rpc.less';

interface WeatherForecast {
  date: string;
  temperatureC: number;
  temperatureF: number;
  summary:	string;
}

@customElement('app-rpc')
class Rpc extends LitElement {
  static styles = unsafeCSS(styles);

  #forecast: WeatherForecast[] = [];
  #status: string = null;

  async firstUpdated(changedProperties: PropertyValues) {
    try {
      this.#forecast = await request('/weatherforecast');
    } catch(e) {
      this.#status = e.statusText;
    }

    this.requestUpdate();
  }

  render() {
    if(this.#status)
      return html`
        <p>Calling server: ${this.#status}</p>
      `;

    return html`
      <p>
        ${this.#forecast.map(forecast => html`
          <div>
            ${forecast.date.replace(/T.*/, '')}
            ${forecast.temperatureC}
            ${forecast.temperatureF}
            ${forecast.summary}
          </div>
        `)}
      </p>
    `;
  }
}
