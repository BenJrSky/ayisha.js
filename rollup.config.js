import { terser } from '@rollup/plugin-terser';

const config = {
  input: 'ayisha.js',
  output: [
    {
      file: 'dist/ayisha.esm.js',
      format: 'es'
    },
    {
      file: 'dist/ayisha.cjs.js',
      format: 'cjs',
      exports: 'named'
    },
    {
      file: 'dist/ayisha.umd.js',
      format: 'umd',
      name: 'Ayisha',
      exports: 'named'
    },
    {
      file: 'dist/ayisha.min.js',
      format: 'umd',
      name: 'Ayisha',
      exports: 'named',
      plugins: [terser()]
    }
  ]
};

export default config;