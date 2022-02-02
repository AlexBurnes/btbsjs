// this is a setting for h3ml scripts

// default values
export const settings = {
    "logLevel"              : 1,                  // default log level for h3ml scripts in system
    "debugLevel"            : 0,                  // default debug level for h3ml scripts
    "homeHost"              : 'devel-server',     // default home server, for working system must be defined as home
    "ctrlHost"              : 'devel-ctr',        // name of control host
    "hackHost"              : 'devel-hack',       // name of hack-server
    "workerHostMask"        : 'worker-server-%d', // prefix name of worker hosts
    "shareHostMask"         : 'share-server-%d' , // prefix name of worker hosts
    "hackNetMaxNodes"       : 24,                 // maximum hacknet nodes
    "hackNetUpgradeNodes"   : 3,                  // number of hacknet nodes upgraded at once
    "hackNetAssetts"        : "own",              // what money hanet use for upgrade
                                                  //     'own' what hacknet produce
                                                  //     'all' all available money is used
}
