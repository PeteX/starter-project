import { css, html, LitElement, PropertyValues } from 'lit';
import { customElement } from 'lit/decorators.js';
import { request } from './comms';
import globalStyles from './styles';

interface WeatherForecast {
  date: string;
  temperatureC: number;
  temperatureF: number;
  summary:	string;
}

@customElement('app-rpc')
class Rpc extends LitElement {
  #forecast: WeatherForecast[] = [];
  #status: string = null;

  async firstUpdated(changedProperties: PropertyValues) {
    try {
      this.#forecast = await request('/weatherforecast');
    } catch(e: any) {
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

  static styles = [globalStyles, css`
    p {
      font-family: var(--body-font);
      color: green;
    }
  `];
}
