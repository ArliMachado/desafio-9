import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Product from '@modules/products/infra/typeorm/entities/Product';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    const updatedStockProducts: Product[] = [];

    if (!customer) {
      throw new AppError('Customer not exists');
    }

    const productsId = products.map(product => ({ id: product.id }));

    const findedProducts = await this.productsRepository.findAllById(
      productsId,
    );

    if (findedProducts.length < products.length) {
      throw new AppError('Your list contains some non-existent products.');
    }

    const orderProducts = findedProducts.map(item => {
      const itemProduct = products.find(product => item.id === product.id);

      if (!itemProduct) {
        throw new AppError('Product not found in database');
      }

      if (item.quantity < itemProduct.quantity) {
        throw new AppError('Your order contains out of stock products');
      }

      updatedStockProducts.push(
        Object.assign(item, {
          quantity: item.quantity - itemProduct.quantity,
        }),
      );

      return {
        product_id: item.id,
        price: item.price,
        quantity: itemProduct.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });
    await this.productsRepository.updateQuantity(updatedStockProducts);

    return order;
  }
}

export default CreateOrderService;
