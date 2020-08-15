const firebase = require('firebase-admin')
const crypto = require('crypto')

exports.sourceNodes = (
  { boundActionCreators },
  {
    credential,
    databaseURL,
    contentTypes = 'contentTypes',
    contents = 'contents',
    types,
    quiet = false,
  },
  done
) => {
  const { createNode } = boundActionCreators

  firebase.initializeApp({
    credential: firebase.credential.cert(credential),
    databaseURL: databaseURL,
  })

  const db = firebase.database()
  const start = Date.now()

  // reading Content Types first
  const ref = db.ref(contentTypes)
  ref.once('value').then((snapshot) => {
    const keys = []
    const data = [] // store data in array so it's ordered

    snapshot.forEach((ss) => {
      data.push({ ...ss.val(), uid: ss.key })
      keys.push(ss.key)
    })

    data.map((contentType) => {
      console.log('Found content type:', contentType.name, contentType.uid)

      types.push({
        type: `${contentType.name}`,
        path: `/${contents}/${contentType.uid}`,
      })

      console.log(JSON.stringify(types, null, 2))
    })

    types.forEach(
      ({ query = (ref) => ref, map = (node) => node, type, path }) => {
        if (!quiet) {
          console.log(`\n[Firebase Source] Fetching data for ${type}...`)
        }

        query(db.ref(path)).once('value', (snapshot) => {
          if (!quiet) {
            console.log(
              `\n[Firebase Source] Data for ${type} loaded in`,
              Date.now() - start,
              'ms'
            )
          }

          const val = snapshot.val()

          Object.keys(val).forEach((key) => {
            const node = map(Object.assign({}, val[key]))

            const contentDigest = crypto
              .createHash(`md5`)
              .update(JSON.stringify(node))
              .digest(`hex`)

            createNode(
              Object.assign(node, {
                id: key,
                parent: 'root',
                children: [],
                internal: {
                  type: type,
                  contentDigest: contentDigest,
                },
              })
            )
          })
          done()
        })
      },
      (error) => {
        throw new Error(error)
      }
    )
  })
}
