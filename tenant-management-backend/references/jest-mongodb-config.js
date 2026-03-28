export default {
  mongodbMemoryServerOptions: {
    binary: {
      version: '7.0.0',
      skipMD5: true,
    },
    instance: {
      dbName: 'tenant-test',
    },
    autoStart: false,
  },
};
