const db = require('../../connectors/db');
const roles = require('../../constants/roles');
const { getSessionToken } = require('../../utils/session');

const getUser = async function (req, res) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect('/');
  }

  const user = await db
    .select('*')
    .from('se_project.sessions')
    .where('token', sessionToken)
    .innerJoin('se_project.users', 'se_project.sessions.userid', 'se_project.users.id')
    .innerJoin('se_project.roles', 'se_project.users.roleid', 'se_project.roles.id')
    .first();

  console.log('user =>', user);
  //user.isStudent = user.roleid === roles.student;
  user.isUser = user.roleid === roles.user;
  user.isAdmin = user.roleid === roles.admin;
  user.isSenior = user.roleid === roles.senior;

  return user;
};

module.exports = function (app) {
  // Register HTTP endpoint to render /dashboard page
  app.get('/dashboard', async function (req, res) {
    const user = await getUser(req, res);
    if (typeof user === 'undefined') {
      return res.redirect('/');
    }
    return res.render('dashboard', user);
  });

  // Register HTTP endpoint to render /users page
  app.get('/users', async function (req, res) {
    const users = await db.select('*').from('se_project.users');
    return res.render('users', { users });
  });

  // Register HTTP endpoint to render /stations page
  app.get('/stations_example', async function (req, res) {
    const user = await getUser(req, res);
    if (typeof user === 'undefined') {
      return res.redirect('/');
    }
    const stations = await db.select('*').from('se_project.stations');
    return res.render('stations_example', { ...user, stations });
  });

  // Register HTTP endpoint to render /resetpassword page
  app.get('/resetpassword', async function (req, res) {
    const user = await getUser(req, res);
    if (typeof user === 'undefined') {
      return res.redirect('/');
    }
    return res.render('resetpassword');
  });

app.get('/rides', async function (req, res) {
  const user = await getUser(req, res);
  if (typeof user === 'undefined') {
    return res.redirect('/');
  }
  const rides = await db.select('*').from('se_project.rides');
  return res.render('rides', { ...user, rides });
});

app.get('/updatestation/:id', async function (req, res) {
  const user = await getUser(req, res);
  if (typeof user === 'undefined') {
    return res.redirect('/');
  }
  const stationId = req.params.id;
  const station = await db('se_project.stations').where('id', stationId).first();
  return res.render('updatestation', { ...user, stationId });
});

app.get('/managezones', async function (req, res) {
  const user = await getUser(req, res);
  if (typeof user === 'undefined') {
    return res.redirect('/');
  }

  try {
    const zones = await db.select('*').from('se_project.zones');
    return res.render('managezones', { ...user, zones });
  } catch (error) {
    console.error('Error fetching zones:', error);
    return res.status(500).send('Could not fetch zones. Please try again.');
  }
});

app.get('/updatezoneprice/:id', async function (req, res) {
  const user = await getUser(req, res);
  if (typeof user === 'undefined') {
    return res.redirect('/');
  }
  const zoneId = req.params.id;
  const zone = await db('se_project.zones').where('id', zoneId).first();
  return res.render('updatezoneprice', { ...user, zoneId });
});

app.get('/createstations', async function (req, res) {
  const stations = await db.select('*').from('se_project.stations');
  return res.render('createstations');
});
app.get('/rides', async function (req, res) {
  const rides = await db.select('*').from('se_project.rides');
  return res.render('rides');
});

app.get('/stations_example/:id', async function (req, res) {
  const user = await getUser(req, res);
  if (typeof user === 'undefined') {
    return res.redirect('/');
  }
  const stationId = req.params.id;
  const station = await db('se_project.stations').where('id', stationId).first();
  return res.render('stations_example', { ...user, station });
});
app.get('/refund_requests', async function (req, res) {
  const user = await getUser(req, res);
  if (typeof user === 'undefined') {
    return res.redirect('/');
  }
  // Fetch necessary data for the drop-down menus (e.g., origin, destination)
  const refundrequests = await db.select('*').from('se_project.refund_requests');
  // Render the "simulate-ride" view and pass the necessary data
  return res.render('refund_requests', { ...user, refundrequests });
});

app.get('/ticketinfo', async function(req, res) {
  const user = await getUser(req, res);
  const tickets = await db.select('*').from('se_project.tickets');
  return res.render('ticketinfo', { ...user, tickets });
});

app.get('/payment', async function(req, res) {
  const user = await getUser(req, res);
  return res.render('payment', { user });
});

app.get('/subscription:id', async function(req, res) {
  const user = await getUser(req, res);
  const subid = req.params.id;
  return res.render('subscription', { ...user,subid });
});
app.get('/usersubscription', async function(req, res) {
  const user = await getUser(req);
  const subscriptions = await db.select("*").from("se_project.subsription");
  return res.render('usersubscription',{subscriptions,...user});
});
app.get('/userefundrequests', async function(req, res) {
  const user = await getUser(req);
  const refund_requests = await db.select("*").from("se_project.refund_requests");
  return res.render('requestRefund',{refund_requests,...user});
});
app.get('/userseniorequests', async function(req, res) {
  const user = await getUser(req);
  return res.render('userseniorequests');
});
app.get('/routes', async function(req, res) {
  const routes = await db.select("*").from("se_project.routes");
  return res.render('manageRoutes', { routes });
});
app.get('/createRoute', async function(req, res) {
  const routes = await db.select("*").from("se_project.routes");
  return res.render('CreateRoute', { routes });
});
app.get('/subscriptions', async function(req, res) {
  const sub = await db.select('*').from('se_project.subscriptions');
  return res.render('subscription', { ...user, sub });
});
app.get('/senior_request', async function(req, res) {
  const user = await getUser(req);
  return res.render('seniorrequest');
});
app.get('/manage-senior', async function(req, res) {
  try {
    const user = await getUser(req, res);
    if (user === 'undefined') {
      return res.redirect('/');
    }
    const seniorRequest = await db("se_project.senior_requests").where('status', 'pending');
    return res.render('manage-senior', { ...user, seniorRequest });
  } catch (error) {
    console.error(error);
    return res.status(500).send('Internal Server Error');
  }
});
app.get('/payment', async function(req, res) {
  const user = await getUser(req, res);
  const tickets = await db.select('*').from('se_project.subsription');
  return res.render('payment', { ...user, tickets });
});

app.get('/tickets', async function (req, res) {
  const user = await getUser(req, res);
  if (typeof user === 'undefined') {
    return res.redirect('/');
  }
  // Fetch necessary data for the drop-down menus (e.g., origin, destination)
  const tickets = await db.select('*').from('se_project.tickets');
  // Render the "simulate-ride" view and pass the necessary data
  return res.render('tickets', { ...user, tickets });
});
app.get('/prices', async function(req, res){
  const user = await getUser(req);
  const tickets = await db.select('*').from('se_project.tickets');
  return res.render('prices', {tickets});
});
app.get('/rides', async function(req, res) {
  const user = await getUser(req);
  return res.render('rides');
});
  //simulate ride
app.get('/simulate-ride', async function(req, res) {
  const user = await getUser(req);
  const rides = await db.select("*").from("se_project.rides");
  return res.render('simulate-ride',{rides});
});
app.get('/subscriptions', async function (req, res) {
  const subscription = await db.select('*').from('se_project.subsription');
  const ticket = await db.select('*').from('se_project.tickets');
  return res.render('subscription', { subscription, ticket });
});

};
  
