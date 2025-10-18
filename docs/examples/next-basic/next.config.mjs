// next.config.mjs (ESM)
import { withICBINCSS } from 'i-cant-believe-its-not-css';

export default withICBINCSS(
  {
    reactStrictMode: true,
  },
  {
    // Optional: override output path (otherwise read from icbincss.config.json)
    // outFile: 'public/icbincss.css',
  }
);

