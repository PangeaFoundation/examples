const { Client, RequestFormats } = require("pangea-client");

require("dotenv").config({ override: true });


const config = {
  MOVEFUN_ADDRESS: "0x4c5058bc4cd77fe207b8b9990e8af91e1055b814073f0596068e3b95a7ccd31a"
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let events_cache = {
  FaDeployed: [],
  FaBought: [],
  FaSold: [],
  FaMigrated: []
}

async function fetchLatestCoinEvents(eventType, limit = 100) {
  return events_cache[eventType]
}

async function watch() {
  while (true) {
    console.log('sold', await fetchLatestCoinEvents('FaSold'))
    console.log('sold', await fetchLatestCoinEvents('FaBought'))
    await sleep(1000)
  }
}

async function main() {
  watch()


  const client = await Client.build({
    endpoint: "movement.beta.pangea.foundation",
  });



  const handle = await client.get_logs_decoded(
    {
      chains: ["MOVEMENT"],
      from_block: 0,
      to_block: "none", // this means stream forever. "latest" for the current head or a number for a fixed range
      address__in: [config.MOVEFUN_ADDRESS],
      event_name__in: Object.keys(events_cache)
    },
    RequestFormats.JSON_STREAM
  );

  try {
    for await (const chunk of handle) {
      chunk
        .toString()
        .split("\n")
        .filter(Boolean)
        .forEach((line) => {
          let log = JSON.parse(line);
          log.decoded = JSON.parse(log.decoded);
          // console.log(JSON.stringify(log, null, 2));
          events_cache[log.event_name].push(log)
          events_cache[log.event_name] = events_cache[log.event_name].slice(-100)
        });
    }
  } finally {
    client.disconnect();
  }


}

main();
