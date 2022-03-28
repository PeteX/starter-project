import { css } from 'lit';

export default css`
  a {
    color: var(--link);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  h1, h2, h3 {
    font-family: var(--heading-font);
    font-weight: bold;
  }

  label {
    font-family: var(--ui-font);
  }
`;