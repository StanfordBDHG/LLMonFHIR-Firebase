import {DefaultServiceFactory, ServiceFactoryOptions} from "./default-service-factory";
import {ServiceFactory} from "./service-factory";

export function getServiceFactory(options: ServiceFactoryOptions): ServiceFactory {
  return new DefaultServiceFactory(options);
}