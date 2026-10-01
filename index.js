import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = process.env.PORT || 3000;

/*const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "bookNotes",
  password: "r3t5rd3ds0n",
  port: 5432,
});*/

const db = new pg.Client(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        user: "postgres",
        host: "localhost",
        database: "bookNotes",
        password: "r3t5rd3ds0n",
        port: 5432,
      },
);

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let page = 1;
let order = "booklist.id";
let direction = "DESC";

function offset() {
  if (page == 1) {
    return 0;
  } else {
    return page * 10 - 10;
  }
}

async function bookAmount() {
  const amount = await db.query("SELECT COUNT(*) FROM booklist");
  let list = amount.rows;
  return list[0].count;
}

async function bookData() {
  const thing = await db.query(
    `SELECT booklist.id, booklist.book_name, description, link, recommenders.name FROM booklist JOIN recommenders ON booklist.userid = recommenders.id ORDER BY ${order} ${direction} LIMIT 10 OFFSET ($1)`,
    [offset()],
  );
  let recs = thing.rows;
  return recs;
}

app.get("/", async (req, res) => {
  let books = await bookData();
  let pages = Math.ceil((await bookAmount()) / 10) + 1;
  res.render("index.ejs", { books, pages });
});

app.post("/page", async (req, res) => {
  page = req.body.whichPage;
  console.log(page);
  res.redirect("/");
});

app.post("/sort", async (req, res) => {
  switch (req.body.sort) {
    case "new":
      order = "booklist.id";
      direction = "DESC";
      break;
    case "old":
      order = "booklist.id";
      direction = "ASC";
      break;
    case "alphDown":
      order = "book_name";
      direction = "ASC";
      break;
    case "alphUp":
      order = "book_name";
      direction = "DESC";
      break;
    case "recDown":
      order = "name";
      direction = "ASC";
      break;
    case "recUp":
      order = "name";
      direction = "DESC";
      break;
  }

  res.redirect("/");
});

app.post("/add", (req, res) => {
  res.render("new.ejs");
});

app.post("/insert", async (req, res) => {
  //console.log(req.body);
  let lowerName = req.body.yourName;
  let newLink = `https://covers.openlibrary.org/b/ISBN/${req.body.isbn}-M.jpg`;
  let existingId;
  let newRecommenderId;
  let inserted;
  if (req.body.password.toLowerCase() == "holland") {
    try {
      let exists = await db.query(
        "SELECT 1 FROM recommenders WHERE LOWER(name) = ($1) LIMIT 1",
        [lowerName],
      );
      if (exists.rows.length > 0) {
        try {
          existingId = await db.query(
            "SELECT id FROM recommenders WHERE LOWER(name) = ($1)",
            [lowerName],
          );
        } catch (err) {
          console.log("Could not grab ID");
        }
        try {
          await db.query(
            "INSERT INTO booklist (book_name, userid, description, link) VALUES (($1),($2),($3),($4))",
            [
              req.body.title,
              existingId.rows[0]?.id,
              req.body.description,
              newLink,
            ],
          );
        } catch (err) {
          console.log("Entry already exists or something");
        }
      } else {
        try {
          inserted = await db.query(
            "INSERT INTO recommenders (name) VALUES (($1))",
            [lowerName],
          );
        } catch (err) {
          console.log("Unable to create new recommender");
        }

        newRecommenderId = inserted.rows[0].id;

        try {
          await db.query(
            "INSERT INTO booklist (book_name, userid, description, link) VALUES (($1),($2),($3),($4))",
            [req.body.title, newRecommenderId, req.body.description, newLink],
          );
        } catch (err) {
          console.log(
            "Unable to create new book entry AFTER creating new recommender",
          );
        }
      }
    } catch (err) {
      console.log("Couldn't create book entry");
    }
  }

  res.redirect("/");
});

app.post("/edit", async (req, res) => {
  console.log(req.body);
  let newLink;
  if (req.body.updatedItemISBN.length == 10) {
    newLink = `https://covers.openlibrary.org/b/ISBN/${req.body.updatedItemISBN}-M.jpg`;
  } else {
    newLink = req.body.currentLink;
  }
  if (req.body.password.toLowerCase() == "holland") {
    try {
      await db.query(
        "UPDATE booklist SET book_name = ($1), description = ($2), link = ($3) WHERE id=($4)",
        [
          req.body.updatedItemTitle,
          req.body.updatedItemDescription,
          newLink,
          req.body.updatedItemId,
        ],
      );
    } catch (err) {
      console.log("Couldn't update book");
    }
  }

  res.redirect("/");
});

app.post("/delete", async (req, res) => {
  if (req.body.password.toLowerCase() == "ilovehailey") {
    try {
      await db.query("DELETE FROM booklist WHERE id=($1)", [req.body.id]);
    } catch (err) {
      console.log("Couldn't delete entry");
    }
  }

  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
