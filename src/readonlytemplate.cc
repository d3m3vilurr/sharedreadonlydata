#include <iostream>
#include <v8.h>
#include <node.h>
#include <nan.h>

using namespace node;
using namespace v8;

#define NanReturn(value) { info.GetReturnValue().Set(value); return; }
#define NanException(type, msg) \
	Exception::type(Nan::New(msg).ToLocalChecked())
#define NanThrowException(exc) { \
	Nan::ThrowError(exc); NanReturn(Nan::Undefined()); \
}

class ReadOnlyTemplate: ObjectWrap
{
private:

public:

	static Nan::Persistent<Function> SuperClass;
	static NAN_MODULE_INIT(Init)
	{
		Nan::HandleScope scope;

		Local<FunctionTemplate> t = Nan::New<FunctionTemplate>(New);

		t->InstanceTemplate()->SetInternalFieldCount(1);
		t->SetClassName(Nan::New("ReadOnlyTemplate").ToLocalChecked());
		Nan::SetPrototypeMethod(t, "create", CreateReadOnlyTemplate);

		SuperClass.Reset(t->GetFunction());

		target->Set(Nan::New("ReadOnlyTemplate").ToLocalChecked(),
					t->GetFunction());
	}

	ReadOnlyTemplate()
	{
	}

	~ReadOnlyTemplate()
	{
	}

	static NAN_METHOD(New)
	{
		Nan::HandleScope scope;
		ReadOnlyTemplate* hw = new ReadOnlyTemplate();
		hw->Wrap(info.This());
		NanReturn(info.This());
	}

	static NAN_PROPERTY_GETTER(GetByName)
	{
		Nan::HandleScope scope;

		// Send real properties untouched
		Local<Value> value = info.This()->GetRealNamedProperty(property);
		if (!value.IsEmpty()) {
			NanReturn(value);
		}

		Local<String> getter = Nan::New("__get__").ToLocalChecked();

		Local<Value> accessor =
			info.This()->GetRealNamedPropertyInPrototypeChain(getter);
		if (accessor.IsEmpty() || !accessor->IsFunction()) {
			NanReturn(accessor);
		}
		int argc = 1;
		Local<Value> argv[1];
		argv[0] = property;
		Local<Value> dynProperty =
			accessor.As<Function>()->Call(info.This(), argc, argv);
		NanReturn(dynProperty);
	}

	static NAN_INDEX_GETTER(GetByIndex)
	{
		Nan::HandleScope scope;

		Local<String> getter = Nan::New("__get__").ToLocalChecked();

		Local<Value> accessor =
			info.This()->GetRealNamedPropertyInPrototypeChain(getter);
		if (accessor.IsEmpty() || !accessor->IsFunction()) {
			NanReturn(accessor);
		}

		int argc = 1;
		Local<Value> argv[1];
		argv[0] = Nan::New<Number>(index);
		Local<Value> dynamicProperty =
			accessor.As<Function>()->Call(info.This(), argc, argv);
		String::Utf8Value res2(dynamicProperty->ToString());
		NanReturn(dynamicProperty);
	}

	static NAN_PROPERTY_ENUMERATOR(Enum)
	{
		Nan::HandleScope scope;

		Local<String> enumerator = Nan::New("__enum__").ToLocalChecked();
		Handle<Value> accessor =
			info.This()->GetRealNamedPropertyInPrototypeChain(enumerator);
		if (accessor.IsEmpty() || !accessor->IsFunction()) {
			NanReturn(Nan::New<Array>());
		}
		Local<Value> result =
			accessor.As<Function>()->Call(info.This(), 0, NULL);
		NanReturn(result.As<Array>());
	}

	static NAN_METHOD(CreateReadOnlyTemplate)
	{
		Nan::HandleScope scope;

		Local<FunctionTemplate> t = Nan::New<FunctionTemplate>(New);
		t->InstanceTemplate()->SetInternalFieldCount(2);
		t->SetClassName(Nan::New("ReadOnlyTemplate").ToLocalChecked());
		SetNamedPropertyHandler(t->InstanceTemplate(),
								GetByName, NULL, NULL, NULL, NULL);
		SetIndexedPropertyHandler(t->InstanceTemplate(),
								  GetByIndex, NULL, NULL, NULL, Enum);

		SuperClass.Reset(t->GetFunction());
		NanReturn(t->GetFunction());
	}
};

Nan::Persistent<Function> ReadOnlyTemplate::SuperClass;

extern "C" {
	static NAN_MODULE_INIT(init)
	{
		ReadOnlyTemplate::Init(target);
	}

	NODE_MODULE(readonlytemplate, init);
}
