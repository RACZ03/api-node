const express = require('express');
const dotenv = require('dotenv');
const winston = require('winston');
const expressWinston = require('express-winston');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

let successfulSubmissions = 0;
let failedSubmissions = 0;
let successfulDeliveries = 0;
let failedDeliveries = 0;

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'api-node' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Express Logging
app.use(expressWinston.logger({
  transports: [
    new winston.transports.Console(),
  ],
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
  meta: false,
  msg: 'HTTP {{req.method}} {{req.url}}',
  expressFormat: true,
  colorize: false,
}));

// Express JSON middleware increase payload limit
app.use(express.json({ limit: '30mb' }));

// Endpoint para hellow
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/api/v1/submit_sm', async (req, res) => {
  try {
    const requestData = req.body;
    console.log('Received submission success');
    successfulSubmissions++;
    res.status(200).send('Submission received successfully');
  } catch (error) {
    logger.error('Error handling submission:', error);
    failedSubmissions++;
    res.status(500).send('Error handling submission');
  }
});

app.post('/api/v1/deliver_sm', async (req, res) => {
  try {
    const deliverData = req.body;
    console.log('Received delivery success');
    successfulDeliveries++; 
    res.status(200).send('Delivery received successfully');
  } catch (error) {
    logger.error('Error handling delivery:', error);
    failedDeliveries++;
    res.status(500).send('Error handling delivery');
  }
});

function logRecordStats() {
    logger.info(`Successful Submissions: ${successfulSubmissions}, Failed Submissions: ${failedSubmissions}`);
    logger.info(`Successful Deliveries: ${successfulDeliveries}, Failed Deliveries: ${failedDeliveries}`);
}
  
  // Llamar a la función para registrar estadísticas cada cierto tiempo (por ejemplo, cada hora)
  setInterval(logRecordStats, 3600000);


// Express Error Logging
app.use(expressWinston.errorLogger({
  transports: [
    new winston.transports.Console(),
  ],
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
}));

// Express Error Handling
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
console.log(cluster.isMaster);
if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
    
    // Fork workers.
    for (let i = 0; i < 2; i++) {
        cluster.fork();
    }
    
    // Listen for dying workers
    cluster.on('exit', (worker) => {
        // Replace the dead worker
        console.log(`Worker ${worker.id} died`);
        cluster.fork();
    });
}
else {
    // Worker processes have a http server.
    app.listen(3000);
    console.log(`Worker ${process.pid} started`);
}
