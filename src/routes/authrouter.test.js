const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

function randomName() {
  return 'user' + Math.random().toString(36).substring(2, 10);
}

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;

  expect(testUserAuthToken).toBeDefined();
  expectValidJwt(testUserAuthToken);

  const adminUser = await createAdminUser();
  const adminLoginRes = await request(app).put('/api/auth').send({
    email: adminUser.email,
    password: 'toomanysecrets',
  });
  testAdminAuthToken = adminLoginRes.body.token;

  expect(testAdminAuthToken).toBeDefined();
  expectValidJwt(testAdminAuthToken);
});

test('register', async () => {
  const res = await request(app).post('/api/auth').send(testUser);
  expect(res.status).toBe(200);
  expectValidJwt(res.body.token);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test('list franchises', async () => {
  const res = await request(app)
    .get('/api/franchise')
    .set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('create franchise (unauthorized)', async () => {
  const franchise = { name: 'pizzaPocket', admins: [{ email: 'f@jwt.com' }] };
  const res = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send(franchise);
  expect(res.status).toBe(403);
});

test('get menu', async () => {
  const res = await request(app).get('/api/order/menu');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});

test('add menu item (unauthorized)', async () => {
  const menuItem = { title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 };
  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send(menuItem);
  expect(res.status).toBe(403);
});

test('get orders (unauthorized)', async () => {
  const res = await request(app)
    .get('/api/order')
    .set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('orders');
});

test('logout', async () => {
  const res = await request(app)
    .delete('/api/auth')
    .set('Authorization', `Bearer ${testUserAuthToken}`);
  expect(res.status).toBe(200);
  expect(res.body.message).toBe('logout successful');
});

test('add menu item (authorized)', async () => {
  const menuItem = { title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 };
  const res = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${testAdminAuthToken}`) // Admin auth required
    .send(menuItem);
  expect(res.status).toBe(200);
});

test('get orders (authorized)', async () => {
  const res = await request(app)
    .get('/api/order')
    .set('Authorization', `Bearer ${testAdminAuthToken}`);
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('orders');
});

test('create order (authorized)', async () => {
  const order = {
    franchiseId: 1,
    storeId: 1,
    items: [{ menuId: 1, description: 'Veggie', price: 0.05 }],
  };
  
  const res = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${testAdminAuthToken}`) // Any authenticated user can order
    .send(order);
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('order');
});

test('register with missing email fails', async () => {
  const res = await request(app).post('/api/auth').send({ name: 'Test', password: 'password' });
  expect(res.status).toBe(400);
});

test('register duplicate user fails', async () => {
  await request(app).post('/api/auth').send(testUser);
  const res = await request(app).post('/api/auth').send(testUser);
  expect(res.status).toBe(400);
});

test('login with wrong password fails', async () => {
  const res = await request(app).put('/api/auth').send({ ...testUser, password: 'wrongpass' });
  expect(res.status).toBe(401);
});

test('accessing protected route with invalid token fails', async () => {
  const res = await request(app)
    .get('/api/order')
    .set('Authorization', `Bearer invalidToken`);
  expect(res.status).toBe(401);
});

test('create order with invalid menuId fails', async () => {
  const order = {
    franchiseId: 1,
    storeId: 1,
    items: [{ menuId: 999, description: 'Invalid item', price: 5.00 }],
  };
  
  const res = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${testAdminAuthToken}`)
    .send(order);
  expect(res.status).toBe(400);
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}