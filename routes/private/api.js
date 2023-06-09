const { isEmpty, isNull } = require("lodash");
const { v4 } = require("uuid");
const db = require("../../connectors/db");
const roles = require("../../constants/roles");
const {getSessionToken}=require('../../utils/session')
const getUser = async function (req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect("/");
  }
  console.log("hi",sessionToken);
  const user = await db
    .select("*")
    .from("se_project.sessions")
    .where("token", sessionToken)
    .innerJoin(
      "se_project.users",
      "se_project.sessions.userid",
      "se_project.users.id"
    )
    .innerJoin(
      "se_project.roles",
      "se_project.users.roleid",
      "se_project.roles.id"
    )
   .first();

  console.log("user =>", user);
  user.isNormal = user.roleid === roles.user;
  user.isAdmin = user.roleid === roles.admin;
  user.isSenior = user.roleid === roles.senior;
  console.log("user =>", user)
  return user;
};

module.exports = function (app) {
  // example
  app.get("/users", async function (req, res) {
    try {
       const user = await getUser(req);
      const users = await db.select('*').from("se_project.users")
        
      return res.status(200).json(users);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not get users");
    }
   
  });
  //RESET PASSWORD(USER)
  app.put('/api/v1/password/reset', async (req, res) => {
    try {
      const user = await getUser(req);
      const newPassword = req.body.newPassword;
      
      await db("se_project.users").where("id", user.userid).update({ password: newPassword });
  
      return res.status(200).json({ message: "Password reset successful" });
    } catch (e) {
      console.error('Error resetting password:', e);
      return res.status(400).json({ message: "Could not reset password" });
    }
  });
  //GET ZONE
  app.get("/api/v1/zones",async function (req,res){
    try{
      const zones= await db.select("*").from("se_project.zones") 
      return res.status(200).json(zones);
   }
   catch(e){
    console.log("error message: ",e.message)
    return res.status(400).send("could not get zones");
   }
  });
  //PAY FOR SUBSCRIPTION ONLINE
  app.post("/api/v1/payment/subscription",async function (req, res){
    try{
       const user = await getUser(req);
       const{creditcardnumber, holdername, payedamount, subtype, zoneid}=req.body;
  
      let nooftickets =0; 
      if(subtype=="monthly"){
        nooftickets=10;
       }
       else if(subtype=="quarterly"){
        nooftickets=50;
       }
       else if(subtype=="annual"){
        nooftickets=100;
       }
       const subscription ={nooftickets,subtype:subtype,zoneid:zoneid,userid:user.id}
       const [subscriptionid] = await db("se_project.subsription").insert(subscription).returning("id");
       console.log( "subscriptionid",subscriptionid)
       const transaction = await db("se_project.transactions")
          .insert({
            amount: payedamount,
            userid: user.userid,
            purchasediid: subscriptionid,
            purchasetype: "subscription",
          })
          .returning("*");
       const [transactionsid] = await db.select("id").from("se_project.transactions");
        return res.status(200).json({transactionsid, subscriptionid});
    }
    catch(e){
       console.log(e.message);
       return res.status(400).send("failed subscription")
    }
  });
  //PAY FOR TICKET ONLINE
  app.post('/api/v1/payment/ticket', async function(req, res) {
    try {
      const user = await getUser(req);
      const { creditCardNumber, holderName, payedAmount, origin, destination, tripDate } = req.body;
  
      if (!creditCardNumber || !holderName || !payedAmount || !origin || !destination || !tripDate) {
        return res.status(400).send('One or more required fields are missing.');
      }
  
      const ticket = {
        origin,
        destination,
        userid: user.userid,
        tripdate: tripDate
      };
  
      const [ticketId] = await db("se_project.tickets").insert(ticket).returning("id");
  
      const transaction = await db("se_project.transactions").insert({
        amount: payedAmount,
        userid: user.userid,
        purchasediid: ticketId,
        purchasetype: "online"
      }).returning("id");
  
      const rideTicket = {
        status: "upcoming",
        origin,
        destination,
        userid: user.userid,
        ticketid: ticketId,
        tripdate: tripDate
      };
  
      const purchasedTicket = await db("se_project.rides").insert(rideTicket).returning("*");
  
      res.status(200).json({ message: 'Ticket purchased successfully.', purchasedTicket });
    } catch (e) {
      console.log(e.message);
      res.status(400).send('An error occurred while processing the ticket purchase.');
    }
  });
  
  //PAY FOR TICKET BY SUBSCRIPTION 
  app.post('/api/v1/tickets/purchase/subscription', async function(req, res) {
    try {
      const user = await getUser(req);
      const subid = req.body.subid;
      const origin = req.body.origin;
      const destination = req.body.destination;
      const tripdate = req.body.tripdate;
  
      const ticket = {
        origin,
        destination,
        userid: user.userid,
        subid: subid,
        tripdate: tripdate
      };
  
      const ticketid = await db("se_project.tickets").insert(ticket).returning("*");
      console.log(ticketid);
  
      const transaction = await db("se_project.transactions").insert({
        amount: 0,
        userid: user.userid,
        purchasediid: ticketid[0].id,
        purchasetype: "online" // Updated column name to "purchasedType"
      }).returning("id");
  
      const rideTicket = {
        status: "upcoming",
        origin,
        destination,
        userid: user.userid,
        ticketid: ticketid[0].id,
        tripdate: tripdate
      };
  
      const purchasedTicket = await db("se_project.rides").insert(rideTicket).returning("*");
  
      // Respond with success message and the created ticket
      res.status(200).json({ message: 'Ticket purchased successfully.', purchasedTicket });
    } catch (e) {
      // Handle any errors that occurred during the database operation
      console.log(e.message);
      res.status(400).send('An error occurred while processing the ticket purchase.');
    }
  });
  
  
  
  //bygeeb el tickets el 3nd el user
 app.get('/api/v1/user_tickets', async function(req, res) {
  try {
    const user = await getUser(req);
    const userId = user.userid;

    // Fetch the user's tickets from the database based on the userId
    const userTickets = await db('se_project.tickets')
      .where('userid', userId)
      .select('*');

    res.status(200).json(userTickets);
  } catch (error) {
    console.log(error);
    res.status(500).send('Internal Server Error');
  }
 });
  //CHECK PRICE
 app.get("/api/v1/tickets/price/:originId&:destinationId", async function (req, res) {
      try {
         const user = await getUser(req);
         const originId = req.params.originId;
         const destinationId = req.params.destinationId;
         console.log(originId)
         //selecting station id
         const originStation = await db.select("id").from("se_project.stations").where("id", originId);
         const originStationId = originStation[0].id;
        console.log(originStationId);
    
         //select route id
        const route = await db.select("*").from("se_project.routes").where("fromstationid", originStationId).andWhere("tostationid", destinationId);
        console.log(route);
    
        const routeId = route[0].id;
    
         //Determine the stations passed by the route
         const stationRoutes = await db.select("stationid").from("se_project.stationroutes").where("routeid", routeId);
         const stationsPassed = stationRoutes.map((row) => row.stationid);
         console.log(stationsPassed);
    
         //get the number of stops 
         const numStops = stationsPassed.length;
         const visitedStations = [];
         for (const stationId of stationsPassed) {
          const station = await db.select("stationname").from("se_project.stations").where("id", stationId);
          visitedStations.push(station[0].stationname);
        }
        console.log(visitedStations);
        let ticketPrice;
        if( numStops <=9){
          ticketPrice = 5;
        } else if (numStops <= 16){
          ticketPrice = 7;
        } else {
          ticketPrice = 10;
        }
        return res.json({ticketPrice});
    
      } catch (e) {
        console.log(e.message);
        return res.status(400).send("Could not get the price");
      }
     
    });
  //REFUND REQUEST
  app.post("/api/v1/refund/:ticketId", async function (req, res) {
    try {
      const { ticketId } = req.params;
      const user = await getUser(req);
      const userId = user.userid;

      if (!ticketId) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      const existingRefundRequest = await db('se_project.refund_requests')
        .where('ticketid', ticketId)
        .first();

      if (existingRefundRequest) {
        return res.status(400).json({ message: "Refund request already exists for this ticket" });
      }

      const refundTicket = await db('se_project.tickets').where('id', ticketId).first();
      const currentDate = new Date();
      const tripDate = new Date(refundTicket.tripdate);

      if (tripDate < currentDate) {
        return res.status(400).send('Cannot refund an expired ticket');
      }

      const refundRequest = {
        status: "pending",
        userid: userId,
        refundamount: 0,
        ticketid: ticketId,
      };

      await db("se_project.refund_requests")
        .insert(refundRequest)
        .returning("*");

      res.status(201).json({ message: "Refund request created" });
    } catch (e) {
      console.log(e.message);
      return res.status(500).send("Error requesting refund");
    }
  });
  //REQUEST SENIOR
  app.post("/api/v1/senior/request", async function (req, res) {
    try {
      const user = await getUser(req);
      const { nationalid } = req.body;
      const userid = user.userid;
  
      const newRequest = {
        status: "pending",
        userid: userid,
        nationalid: nationalid
      };
  
      const existingRequest = await db("se_project.senior_requests")
        .where({ nationalid: nationalid })
        .first();
  
      if (existingRequest) {
        return res.status(409).send("Senior request already exists for the provided national ID");
      }
  
      await db("se_project.senior_requests").insert(newRequest);
  
      return res.status(200).send("Request submitted successfully");
    } catch (error) {
      console.error(error);
      return res.status(500).send("Request failed");
    }
  });
  
  //SIMULATE RIDE
  app.put("/api/v1/ride/simulate", async function(req, res) {
  try {
    const user = await getUser(req);
    const { origin, destination, tripdate } = req.body;
    const userId = user.userid;

    console.log(origin,destination,tripdate);
    const ride = await db("se_project.rides")
      .where({
        "origin": origin,
        "destination": destination,
        "tripdate": tripdate,
      //  "userid": userId,
       // "status": "upcoming"
      })
      .first();
    console.log(ride);
    if (!ride) {
      return res.status(404).send("No upcoming ride found with the provided details");
    }

    await db("se_project.rides")
      .where("id", ride.id)
      .update({ status: "completed" });

    return res.status(200).send("Ride simulation successful");
  } catch (e) {
    console.log(e.message);
    return res.status(500).send("Ride simulation failed");
  }
});
    
  //RESET PASSWORD(ADMIN) => RUNS PERFECTLY
  app.put('/api/v1/password/reset', async (req, res) => {
    try {
      const user = await getUser(req);
      const newPassword = req.body.newPassword;
      if(user.isAdmin){
        await db("se_project.users").where("id", user.userid).update({ password: newPassword });

        return res.status(200).json({ message: "Password reset successful" });
      }
      else{
        return res.status(400).json({ message: 'this user is not an admin' });
      }
    } catch (e) {
      console.error('Error resetting password:', e);
      return res.status(400).json({ message: "Could not reset password" });
    }
  });
  //MANAGE STATIONS
  app.get("/api/v1/stations" , async function (req, res) {
    try {
      const user = await getUser(req);
      if (!user.isAdmin) {
        return res.status(400).json("Unauthorized");
      }
  
     const viewstations = await db.select('*').from("se_project.stations");
        return res.status(200).send({viewstations});
  
    } catch (e) {
      console.log(e.message);
      return res.status(404).json("Could not view stations");
    }
  
   });
  //DELETE STATION(ADMIN)
app.delete('/api/v1/station/:stationId', async (req, res) => {
  try {
    const user = await getUser(req);
    if (user.isAdmin) {
      const stationid = req.params.stationId;
      const stationtodelete = await db("se_project.stations").where("id", "=", stationid).first();
      if (!stationtodelete) {
        return res.status(404).json({ message: "Station not found" });
      }
      const { stationposition, stationtype } = stationtodelete;
      console.log(stationtodelete)

      if (stationtype === "normal" && stationposition === "start") {
      const deletedstation= await db("se_project.stations").where("id", "=", stationid).del();
        const nextstation = await db("se_project.routes").where("tostationid", "=", stationid).first();

         if (nextstation) {
          await db("se_project.stations").where("id", nextstation.fromstationid).update({ stationposition: "start" });
         }
        
      }

      if (stationtype === "normal" && stationposition === "middle") {
        const nextstation = await db("se_project.routes").where("tostationid", "=", stationid).first();
        const deletedstation = await db("se_project.stations").where("id", "=", nextstation.tostationid).del();
        const newRoute1 = { routename: "newRoute1", fromstationid: nextstation.fromstationid, tostationid: nextstation.tostationid };
        const insertedRoute1 = await db("se_project.routes").insert(newRoute1).returning("*");
        const newSR1 = { stationid: nextstation.tostationid, routeid: insertedRoute1[0].id };
        await db("se_project.stationroutes").insert(newSR1);

        const newRoute2 = { routename: "newRoute2", fromstationid: stationtodelete.fromstationid, tostationid: nextstation.tostationid };
        const insertedRoute2 = await db("se_project.routes").insert(newRoute2).returning("*");
        const newSR2 = { stationid: nextstation.tostationid, routeid: insertedRoute2[0].id };
        await db("se_project.stationroutes").insert(newSR2);
      }
       if (stationtype === "transfer" && stationposition === "middle") {
        const deletedStation = await db("se_project.stations").where("id", "=", stationid).del();
      
        const prevstation = await db("se_project.routes").where("tostationid", "=", stationid).first();
        const nextstation = await db("se_project.routes").where("fromstationid", "=", stationid).first();
      
        if (prevstation && nextstation) {
          // Update the route from prevStation to nextStation
          await db("se_project.routes")
            .where("fromstationid", "=", prevstation.fromstationid)
            .andWhere("tostationid", "=", stationid)
            .update({ tostationid: nextstation.tostationid });
      
          // Delete the route from prevStation to current station (transfer station)
          await db("se_project.routes")
            .where("fromstationid", "=", prevstation.fromstationid)
            .andWhere("tostationid", "=", stationid)
            .del();
      
          // Update the stationposition of the next station (3) to "middle"
          await db("se_project.stations")
            .where("id", "=", nextstation.tostationid)
            .update({ stationposition: "middle" });
      
          // Create a new route from prevStation to the other next station (4)
          const newRoute = {
            routename: "newRoute",
            fromstationid: prevstation.fromstationid,
            tostationid: nextstation.fromstationid === stationid ? nextstation.tostationid : nextstation.fromstationid
          };
          const insertedRoute = await db("se_project.routes").insert(newRoute).returning("*");
      
          // Create a new stationroute record for the other next station (4)
          const newSR = { stationid: insertedRoute[0].tostationid, routeid: insertedRoute[0].id };
          await db("se_project.stationroutes").insert(newSR);
        }
      }
      

    if (stationtype === "normal" && stationposition === "end") {
      const deletedstation= await db("se_project.stations").where("id", "=", stationid).del();
        const prevstation = await db("se_project.routes").where("fromstationid", "=", stationid).first();

         if (prevstation) {
          await db("se_project.stations").where("id", prevstation.tostationid).update({ stationposition: "end" });
         }
        
      }
    }
    return res.status(200).json({ message: "station deleted successfully" });
  } catch (e) {
    console.error('Error deleting station:', e);
    return res.status(400).json({ message: "Could not delete station" });
  }
});
//CREATE STATION
app.post("/api/v1/station", async function (req, res) {
  try {
    const user = await getUser(req);
    if (!user || !user.isAdmin) {
      return res.status(403).send("Unauthorized");
    }

    // Check if station already exists in the system
    const stationExists = await db
      .select("*")
      .from("se_project.stations")
      .where("stationname", req.body.stationname);

    if (stationExists.length > 0) {
      return res.status(400).send("This station already exists");
    }

    const newStation = {
      stationname: req.body.stationname,
      stationtype: "normal",
      stationposition: "start",
      stationstatus: "new created",
    };
    const insertedStation = await db("se_project.stations").insert(newStation).returning("*");
    return res.status(200).json(insertedStation);
  } 
  catch (error) 
  {
    console.log(error.message);
    return res.status(500).send("Could not create new station");
  }
});
//UPDATE STATION
app.put("/api/v1/station/:stationId", async function (req, res) {
  try {
    const user = await getUser(req);
    if (!user.isAdmin) {
      return res.status(400).json("You cannot update the station name");
    }
    const stationId = req.params.stationId;
    const stationname = req.body.stationname;

    await db("se_project.stations")
      .where("id", stationId)
      .update({stationname: stationname});

    return res.status(200).send("Name is updated");

  } catch (e) {
    console.log(e.message);
    return res.status(404).json("Station name not found");
  }
});
//TABLE VIEWING ROUTES
app.get("/api/v1/routes" , async function (req, res) {
  try {
    const user = await getUser(req);
    if (!user.isAdmin) {
      return res.status(400).json("Unauthorized");
    }

   const viewroutes = await db.select('*').from("se_project.routes");
      return res.status(200).send({viewroutes});

  } catch (e) {
    console.log(e.message);
    return res.status(404).json("Could not view routes");
  }

 });
//DELETE ROUTE
app.delete('/api/v1/route/:routeId', async (req, res) => {
  try {
    const user = await getUser(req);
    if (user.isAdmin) {
      const routeId = req.params.routeId;
      //const stationId= req.params.stationId;
      const routeDelete = await db('se_project.routes').where('id', routeId);
      console.log(routeDelete)
      if (routeDelete.length== 0) {
        return res.status(404).json({ error: 'Route not found' });
      }
      const { fromstationid, tostationid } = routeDelete[0];
     console.log(tostationid);
     console.log(fromstationid);
    // Updating the position of the stations
    const nextStation = await db('se_project.routes').where('tostationid', fromstationid).first();
    if (nextStation) {
      await db('se_project.stations').where('id', nextStation.fromstationid).update({ stationposition: 'start' });
    
    }
    console.log(nextStation);
    const prevStation = await db('se_project.routes').where('tostationid', tostationid).first();
    if (prevStation) {
      await db('se_project.stations').where('id', prevStation.fromstationid).update({ stationposition: 'start' });
    }
    console.log(prevStation);
    console.log('Route and connected stations deleted successfully');
    await db('se_project.routes').where('id', routeId).del();
    return res.status(200).json({ message: 'Route and connected stations deleted successfully' });
  
  }
  // else if(prevStation == stationposition){
//}
    else {
    return res.status(403).json({ error: 'Unauthorized' });
  }
} catch (error) {
  console.log(error.message);
  return res.status(500).json({ error: 'Cannot delete the route' });
}
});
//CREATE ROUTE
app.post("/api/v1/route", async function (req, res) {
  try {
    const user = await getUser(req);

    if (!user.isAdmin) {
      return res.status(403).send("Unauthorized");
    }

    const { newStationId, connectedStationId, routeName } = req.body;
    let fromStationId, toStationId;
    const connectedStation = await db("se_project.stations")
      .select("*")
      .where({ id: connectedStationId })
      .first();
    const connectedStationPosition = connectedStation.stationposition;

    if (
      connectedStationPosition !== "start" &&
      connectedStationPosition !== "end"
    ) {
      console.log(
        'Invalid position. Only "start" or "end" positions are allowed.'
      );
      return res
        .status(400)
        .send(
          'Invalid position. Only "start" or "end" positions are allowed.'
        );
    }

    const routeExists = await db
      .select("*")
      .from("se_project.routes")
      .where("routename", req.body.routeName);

    if (routeExists.length > 0) {
      return res.status(400).send("This route already exists");
    }

    if (connectedStationPosition === "start") {
      fromStationId = connectedStationId;
      toStationId = connectedStationId + 1;
    } else if (connectedStationPosition === "end") {
      fromStationId = connectedStationId - 1;
      toStationId = connectedStationId;
    } else {
      return res.status(401).send("Only admin users can create routes");
    }

    const newRoute = {
      routename: routeName,
      fromstationid: fromStationId,
      tostationid: toStationId,
    };

    const insertedRoute = await db("se_project.routes")
      .insert(newRoute)
      .returning("*");

    // Update station positions
    await db("se_project.stations")
      .update({ stationposition: "start" })
      .where("id", fromStationId);

    await db("se_project.stations")
      .update({ stationposition: "end" })
      .where("id", toStationId);

    console.log("Route has been created successfully");
    return res.status(200).json(insertedRoute);
  } catch (error) {
    console.log(error.message);
    return res.status(500).send("Could not create new route");
  }
});
//UPDATE ROUTE
app.put('/api/v1/route/:routeId', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user.isAdmin) {
      return res.status(400).json("You cannot update the route name");
    }
      const routeId  = req.params.routeId;
      const routename = req.body.routename;

      await db("se_project.routes")
      .where("id", routeId)
      .update({routename:routename});
      return res.status(200).send("name is updated successfuly");   
  } 
  catch (error) {
    console.log(error.message);
    return res.status(404).json("route name not found");
  }
});
//TABLE VIEWING ALL REFUND REQUESTS
app.get('/api/v1/refundRequests', async function(req, res) {
  try {
    const refundRequests = await db('se_project.refund_requests').select('*');
    res.json(refundRequests);
  } catch (e) {
    console.error('Error retrieving refund requests:', e);
    res.status(500).json({ error: 'An error occurred while retrieving refund requests.' });
  }
});
//REFUND REQUESTS
 app.put("/api/v1/requests/refunds/:requestId", async (req, res) => {
  try {
    const user = await getUser(req);
    const requestId = req.params.requestId;

    if (user.isAdmin) {
      const { refundStatus } = req.body;

      if (refundStatus.toLowerCase() === "accepted") {
        const refundRequest = await db("se_project.refund_requests")
          .where("id", "=", requestId)
          .first();

        if (!refundRequest) {
          return res.status(404).send("Refund request not found");
        }

        const ticket = await db("se_project.tickets")
          .where("id", "=", refundRequest.ticketid)
          .first();

        if (!ticket) {
          return res.status(404).send("Ticket not found");
        }

        const tripDate = new Date(ticket.tripdate);
        const currentDate = new Date();

        if (tripDate <= currentDate) {
          return res.status(400).send("Cannot refund past-dated or ongoing trip tickets");
        }

        if (ticket.subid !== null) {
          const deleteRide = await db("se_project.rides")
            .where("ticketid", "=", ticket.id)
            .del();

          const deleteRefundRequest = await db("se_project.refund_requests")
            .where("id", "=", requestId)
            .del();

          return res.status(200).json({
            message: "Refund request accepted and ticket deleted",
            deletedRide: deleteRide,
            deletedRefundRequest: deleteRefundRequest
          });
        } else {
          const transaction = await db("se_project.transactions")
            .where("id", "=", refundRequest.purchasedIid)
            .first();

          if (!transaction) {
            return res.status(404).send("Transaction not found");
          }

          const deleteTransaction = await db("se_project.transactions")
            .where("id", "=", refundRequest.purchasedIid)
            .del();

          const deleteRide = await db("se_project.rides")
            .where("ticketid", "=", ticket.id)
            .del();

          const deleteRefundRequest = await db("se_project.refund_requests")
            .where("id", "=", requestId)
            .del();

          return res.status(200).json({
            message: "Refund request accepted and ticket deleted",
            deletedTransaction: deleteTransaction,
            deletedRide: deleteRide,
            deletedRefundRequest: deleteRefundRequest
          });
        }
      } else if (refundStatus.toLowerCase() === "rejected") {
        const deleteRefundRequest = await db("se_project.refund_requests")
            .where("id", "=", requestId)
            .del();
        return res.status(200).send({deleteRefundRequest});
      } else {
        return res.status(400).send("Invalid refund status");
      }
    } else {
      return res.status(403).send("Access denied. Only admin can perform this action.");
    }
  } catch (e) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});
//SENIOR REQUESTS
app.put("/api/v1/requests/senior/:requestId", async function (req, res) {
  try {
    const user = await getUser(req);
    if (!user.isAdmin) {
      return res.status(400).json("You cannot accept/reject senior requests");
    }
    const { requestId } = req.params;
    const { seniorStatus } = req.body;
    
    if (seniorStatus === "accepted") {
      const { userid } = await db("se_project.senior_requests").where("id", requestId).first();
      const senior_status = await db("se_project.users").where("id", userid).update("roleid", 3);
      // const totalPrice = totalPrice/2; //purchase         
      const STATUS = await db("se_project.senior_requests").where("id", requestId).update({ status: seniorStatus });
      return res.status(200).json({ message: 'request is accepted' });
    }
    else
      if (seniorStatus === "rejected") {
        const senior_status = await db("se_project.senior_requests").where("id", requestId).update({ status: seniorStatus });

        return res.status(400).send("Access denied");
      }
  }
  catch (e) {
    console.log(e.message);
    return res.status(400).send("Request processing failed");
  }
});

//TABLE VIEWING SENIOR REQUESTS
app.get('/api/v1/seniorRequests', async function (req, res) {
  try {
    const seniorRequests = await db('se_project.senior_requests').select('*');
    res.json(seniorRequests);
  } catch (err) {
    console.error('Error retrieving senior requests:', err);
    res.status(500).json({ error: 'An error occurred while retrieving senior requests.' });
  }
});
//UPDATE ZONE PRICE(ADMIN) => RUNS PERFECTLY
 app.put("/api/v1/zones/:zoneId", async function (req, res) {
    try {
      const user = await getUser(req);
      if (user.isAdmin) {
        const zoneid = req.params.zoneId;
        const price = req.body.price;
        const updateprice = await db
          .select("*")
          .from("se_project.zones")
          .where("id", zoneid)
          .update({ price: price });
        return res.status(200).send({ updateprice, message: "Price is updated" });
      } else {
        return res.status(400).send("You cannot update the price zone");
      }
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("You cannot update the price zone");
    }
});
app.get('/viewStations', async function(req,res){
  const stations= await db.select("*").from("se_project.stations");
  console.log(stations);
  return res.status(200).json(stations);
});
app.get("/api/v1/subscriptons", async function(req,res){
  const sub= await db.select('*').from('se_project.subsription');
  console.log(sub);
  return res.status(200).json(sub);

});
app.get("/api/v1/sub", async function (req, res) {
  try {
    const user = await getUser(req);
    const userId = user.userid;

    const subscription = await db
      .select('*')
      .from('se_project.subsription')
      .where('userid', userId);

    if (subscription.length === 0) {
      res.status(404).json({ error: "No subscription found for the user ID." });
    } else {
      res.status(200).json(subscription);
    }
  } catch (e) {
    console.log(e.message);
    res.status(500).json({ error: "Error retrieving user's subscription" });
  }
});
  
   
};
  
  
 

